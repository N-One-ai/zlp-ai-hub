import type { AIImageProvider, GenerateImageParams, GeneratedImage } from "./types";
import { ProviderError } from "./types";
import { readImageDimensions } from "../image-dimensions";

/**
 * Higgsfield's Marketing Studio Image model — a DIFFERENT endpoint from
 * Higgsfield Soul (higgsfield-provider.ts), with its own request/response
 * shapes. Everything below was verified live against the real API on
 * 2026-10-24 (both free validation-error probes and a few real, billed
 * submissions — not assumed from the public docs, which omit the
 * submission/status response shapes entirely):
 *
 *   POST https://api.higgsfield.ai/marketing-studio/image
 *   header: Authorization: Key <HF_CREDENTIALS>  (same credential as Soul)
 *   body: {
 *     prompt: string,
 *     resolution: "1k" | "2k" | "4k",              // confirmed via 422 enum error
 *     aspect_ratio: "auto"|"1:1"|"3:2"|"2:3"|"4:3"|"3:4"|"16:9"|"9:16"|"21:9", // confirmed via 422 enum error
 *     enhance_prompt: boolean,
 *     image_urls?: string[],                        // required (>=1) when enhance_prompt=true
 *     preset_id?: string (uuid),                     // required when enhance_prompt=true
 *   }
 *   -> { status: "queued", request_id, status_url, cancel_url, expires_after }
 *      (UNLIKE Soul, this endpoint's real response DOES match the
 *      status_url/request_id shape that was wrongly assumed for Soul —
 *      confirmed by submitting a real request and reading the body.)
 *
 *   poll GET status_url (same auth header)
 *   -> { status: "queued"|"in_progress"|"completed"|"failed"|"nsfw"|"canceled",
 *        request_id, status_url, cancel_url, expires_at,
 *        images?: [{ url }],   // present on "completed" — confirmed live
 *        error?: string }      // present on "failed" — confirmed live
 *
 *   Enhance-mode image_urls limit: confirmed live — 3 URLs returns a 400
 *   "image_urls: [...] is too long"; 2 URLs is accepted (passes validation,
 *   then the request proceeds to actually fetch them). Matches the docs'
 *   description of enhance mode: index 0 = required product image, index
 *   1 = optional model/style reference. This adapter caps at 2 for BOTH
 *   modes (the docs don't confirm a different, larger limit for direct/
 *   editing mode, and a live probe with 4 placeholder URLs in direct mode
 *   WAS accepted — but relying on an unconfirmed higher limit for direct
 *   mode isn't worth the risk when the UI only ever needs the same 2
 *   reference slots either way).
 *
 *   Resolution tiers aren't a promise of exact pixels (unlike Soul's
 *   width_and_height) — confirmed live that resolution "1k" + aspect_ratio
 *   "1:1" produced a real 1024x1024 PNG, i.e. "1k" ~= 1024px on the long
 *   edge, but no other tier/ratio combo was independently verified. The
 *   composer therefore never shows a pixel size for this model, only the
 *   resolution/aspect-ratio labels (per product requirement), and
 *   fetchAsImage() below always reads the REAL dimensions from the
 *   downloaded bytes rather than presuming any pixel size.
 *
 *   Presets: GET https://api.higgsfield.ai/marketing-studio/image/presets?size=N&cursor=N
 *   -> { total, cursor, items: [{ id, type, name, cover_image: { url, width, height },
 *        metadata: { aspect_ratio, group_name }, format_slugs }] }
 *   `cursor` in the response is the offset for the next page, or omitted/
 *   same value when there's no more — fetched live and used as `preset_id`,
 *   never hardcoded (presets can change visibility per the docs).
 *
 *   Prompt length: a 20,000-character prompt (paired with an invalid
 *   resolution to keep the probe a free 400) produced no prompt-length
 *   error — kept at 32000 to match every other model's confirmed ceiling,
 *   not a smaller guess.
 */
const BASE_URL = "https://api.higgsfield.ai";
const SUBMIT_PATH = "/marketing-studio/image";
export const MARKETING_STUDIO_PRESETS_PATH = "/marketing-studio/image/presets";
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 60_000; // 4k generations ran noticeably slower than Soul's 720p in live testing
const MAX_REFERENCE_IMAGES = 2;

interface SubmitResponse {
  status: string;
  request_id: string;
  status_url: string;
}
interface StatusResponse {
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | string;
  images?: { url: string }[];
  error?: string;
}

export interface MarketingStudioPreset {
  id: string;
  name: string;
  type: string;
  coverImageUrl: string | null;
  aspectRatio: string | null;
  groupName: string | null;
}

function authHeader(): string {
  return `Key ${process.env.HF_CREDENTIALS}`;
}

/** Fetches ONE page of live presets — called from a Server Action
 * (getMarketingStudioPresets in actions.ts), never cached long-term and
 * never hardcoded, per the docs' own warning that preset visibility
 * changes over time. */
export async function fetchMarketingStudioPresets(
  cursor?: number,
  size = 50
): Promise<{ items: MarketingStudioPreset[]; nextCursor: number | null; total: number }> {
  if (!process.env.HF_CREDENTIALS) {
    throw new ProviderError("unavailable", "Higgsfield chưa được cấu hình API key.");
  }
  const params = new URLSearchParams({ size: String(size) });
  if (cursor !== undefined) params.set("cursor", String(cursor));

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${MARKETING_STUDIO_PRESETS_PATH}?${params}`, {
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new ProviderError("unavailable", `Không thể tải danh sách preset: ${(e as Error).message}`);
  }
  if (!response.ok) throw new ProviderError("unavailable", `Higgsfield trả về lỗi HTTP ${response.status} khi tải preset.`);

  const data = (await response.json()) as {
    total?: number;
    cursor?: number | null;
    items?: Array<{
      id: string;
      name: string;
      type: string;
      cover_image?: { url?: string };
      metadata?: { aspect_ratio?: string; group_name?: string };
    }>;
  };
  const items = (data.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    coverImageUrl: item.cover_image?.url ?? null,
    aspectRatio: item.metadata?.aspect_ratio ?? null,
    groupName: item.metadata?.group_name ?? null,
  }));
  // The API returns the SAME cursor value (not null) when there's no more
  // data left to page through — treat "cursor didn't advance" as the end.
  const nextCursor = typeof data.cursor === "number" && data.cursor !== cursor ? data.cursor : null;
  return { items, nextCursor, total: data.total ?? items.length };
}

export class MarketingStudioImageProvider implements AIImageProvider {
  readonly id = "higgsfield-marketing-studio";
  readonly label = "Higgsfield Marketing Studio";
  readonly description = "Tạo/chỉnh ảnh chiến dịch marketing tới 4K, hỗ trợ preset và ảnh sản phẩm tham chiếu.";
  readonly capabilities = {
    maxCount: 4,
    supportsBatchCount: false,
    supportsNegativePrompt: false,
    maxPromptLength: 32000,
    maxReferenceImages: MAX_REFERENCE_IMAGES,
    supportsAspectRatioResolution: true,
    supportsPromptEnhancement: true,
  };

  isConfigured(): boolean {
    return Boolean(process.env.HF_CREDENTIALS);
  }

  describeAdjustments(params: GenerateImageParams): string[] {
    const adjustments: string[] = [];
    if (params.negativePrompt.trim()) {
      adjustments.push("Marketing Studio không hỗ trợ negative prompt — bỏ qua trường này.");
    }
    if (!params.aspectRatio) adjustments.push('Chưa chọn tỷ lệ khung hình — dùng "auto".');
    if (!params.resolution) adjustments.push('Chưa chọn resolution — dùng "1k".');
    return adjustments;
  }

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    if (!this.isConfigured()) throw new ProviderError("unavailable", "Higgsfield chưa được cấu hình API key.");

    // Never silently send an enhance-mode request that's missing what the
    // real API requires (preset_id + at least the product image) — fail
    // clearly instead of letting the provider reject it with a vaguer error.
    if (params.enhancePrompt) {
      if (!params.presetId) {
        throw new ProviderError("invalid_request", "Chế độ Enhance cần chọn một preset.");
      }
      if (!params.referenceImageUrls || params.referenceImageUrls.length === 0) {
        throw new ProviderError("invalid_request", "Chế độ Enhance cần ít nhất 1 ảnh sản phẩm tham chiếu.");
      }
    }
    if (params.referenceImageUrls && params.referenceImageUrls.length > MAX_REFERENCE_IMAGES) {
      throw new ProviderError("invalid_request", `Marketing Studio chỉ nhận tối đa ${MAX_REFERENCE_IMAGES} ảnh tham chiếu.`);
    }

    const results: GeneratedImage[] = [];
    for (let i = 0; i < params.count; i++) {
      results.push(await this.generateOne(params));
    }
    return results;
  }

  private async generateOne(params: GenerateImageParams): Promise<GeneratedImage> {
    const statusUrl = await this.submit(params);
    const imageUrl = await this.pollUntilDone(statusUrl);
    return this.fetchAsImage(imageUrl);
  }

  private async submit(params: GenerateImageParams): Promise<string> {
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      resolution: params.resolution ?? "1k",
      aspect_ratio: params.aspectRatio ?? "auto",
      enhance_prompt: Boolean(params.enhancePrompt),
    };
    if (params.enhancePrompt) body.preset_id = params.presetId;
    if (params.referenceImageUrls && params.referenceImageUrls.length > 0) body.image_urls = params.referenceImageUrls;

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${SUBMIT_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new ProviderError("unavailable", `Không thể kết nối tới Higgsfield Marketing Studio: ${(e as Error).message}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("unavailable", "Higgsfield từ chối xác thực — kiểm tra lại HF_CREDENTIALS.");
    }
    if (response.status === 429) throw new ProviderError("rate_limited", "Higgsfield đang giới hạn tốc độ (429).");
    if (response.status === 400 || response.status === 422) {
      const errorBody = await response.json().catch(() => null);
      const detail = Array.isArray(errorBody?.detail)
        ? errorBody.detail.map((d: { msg?: string }) => d.msg).join("; ")
        : errorBody?.detail;
      throw new ProviderError("invalid_request", detail || "Higgsfield từ chối yêu cầu không hợp lệ.");
    }
    if (!response.ok) throw new ProviderError("unavailable", `Higgsfield trả về lỗi HTTP ${response.status}.`);

    const data = (await response.json()) as Partial<SubmitResponse>;
    if (!data.status_url) {
      console.error("[Marketing Studio submit] unexpected response shape", { keys: Object.keys(data ?? {}) });
      throw new ProviderError("unavailable", "Higgsfield không trả về status_url hợp lệ để theo dõi tiến trình.");
    }
    return data.status_url;
  }

  private async pollUntilDone(statusUrl: string): Promise<string> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let response: Response;
      try {
        response = await fetch(statusUrl, {
          headers: { Authorization: authHeader() },
          signal: AbortSignal.timeout(10_000),
        });
      } catch (e) {
        throw new ProviderError("unavailable", `Mất kết nối khi theo dõi tiến trình Marketing Studio: ${(e as Error).message}`);
      }
      if (!response.ok) throw new ProviderError("unavailable", `Higgsfield trả về lỗi HTTP ${response.status} khi poll.`);

      const data = (await response.json()) as Partial<StatusResponse>;
      if (data.status === "completed") {
        const url = data.images?.[0]?.url;
        if (!url) {
          console.error("[Marketing Studio poll] completed but no images[0].url", { keys: Object.keys(data ?? {}) });
          throw new ProviderError("unavailable", "Higgsfield báo hoàn tất nhưng không trả về ảnh.");
        }
        return url;
      }
      if (data.status === "nsfw") throw new ProviderError("content_policy", "Higgsfield từ chối do chính sách nội dung.");
      if (data.status === "failed" || data.status === "canceled") {
        throw new ProviderError("unavailable", data.error ?? `Higgsfield báo lỗi khi tạo ảnh (trạng thái: ${data.status}).`);
      }
      // queued/in_progress — keep polling
    }

    throw new ProviderError("timeout", "Higgsfield Marketing Studio không hoàn tất trong thời gian cho phép.");
  }

  private async fetchAsImage(url: string): Promise<GeneratedImage> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      throw new ProviderError("unavailable", `Không thể tải ảnh kết quả từ Higgsfield: ${(e as Error).message}`);
    }
    if (!response.ok) throw new ProviderError("unavailable", `Không thể tải ảnh kết quả (HTTP ${response.status}).`);

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());

    // No pixel-size guarantee from this API (unlike Soul's width_and_height)
    // — always read the real size from the downloaded bytes, never presume
    // one from the resolution tier.
    const realDimensions = readImageDimensions(bytes);
    if (!realDimensions) {
      console.error("[Marketing Studio fetchAsImage] could not read real dimensions from bytes", { contentType, byteLength: bytes.length });
    }

    return {
      bytes,
      contentType,
      width: realDimensions?.width ?? 0,
      height: realDimensions?.height ?? 0,
      isDemo: false,
    };
  }
}
