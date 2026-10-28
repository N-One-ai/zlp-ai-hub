import type { AIImageProvider, GenerateImageParams, GeneratedImage } from "./types";
import { ProviderError } from "./types";
import { nearestHiggsfieldSize } from "./higgsfield-sizes";
import { readImageDimensions } from "../image-dimensions";

/**
 * Higgsfield's REST API, called directly with fetch (same pattern as the
 * Gemini/OpenAI adapters) — NOT the official @higgsfield/client SDK's
 * subscribe() method, and NOT the Higgsfield CLI used by the sibling
 * ZaloPay AI Creative Platform project.
 *
 * Every detail below was verified live against the real API — a real,
 * billed submission on 2026-10-24 (prompt "a red apple on a white table,
 * studio lighting", width_and_height "1536x1152"), not assumed from
 * documentation or the SDK's typings, both of which were already proven
 * wrong once for this endpoint:
 *
 *   POST https://api.higgsfield.ai/v1/text2image/soul
 *   header: Authorization: Key <HF_CREDENTIALS>
 *   body:   { params: { prompt, width_and_height, quality, batch_size,
 *                        enhance_prompt: false, image_reference? } }
 *   -> { id: <job_set_id>, type, created_at,
 *        jobs: [{ id, job_set_type, status: "queued", results: null }],
 *        input_params }
 *     (NOT { status, request_id, status_url } as earlier assumed from a
 *     different Higgsfield endpoint's stale docs — that shape doesn't
 *     exist here, which is what caused every real submission in this
 *     session to fail at the polling step.)
 *
 *   poll GET https://api.higgsfield.ai/v1/job-sets/{job_set_id}
 *   (same response shape, jobs[0].status updates: queued -> completed)
 *   -> on completed: jobs[0].results = {
 *        min: { url, type: "image" },   // smaller preview variant
 *        raw: { url, type: "image" },   // full-resolution output — used here
 *      }
 *
 *   Verified by downloading the real `raw` PNG and reading its header:
 *   exactly 1536x1152 for a 1536x1152 request — Higgsfield's output
 *   genuinely matches width_and_height pixel-for-pixel for every catalog
 *   value, so no server-side resize/crop is needed for this provider.
 *   fetchAsImage() below still reads the real dimensions from the
 *   downloaded bytes rather than trusting the request size, so a future
 *   mismatch (a different quality/style combo, a provider-side change)
 *   is caught and stored accurately instead of assumed.
 *
 *   `enhance_prompt` defaults to true and silently REWRITES the prompt
 *   into a much longer, different one server-side (confirmed: the
 *   `input_params.prompt` echoed back after completion was not the text
 *   that was sent) — explicitly disabled here so the prompt actually used
 *   is the one the user typed, never a silent rewrite.
 *
 *   width_and_height accepts ONLY one of a fixed preset list (confirmed
 *   via the API's own 422 validation error) — see the full catalog in
 *   ./higgsfield-sizes.ts, shared with the UI's HiggsfieldSizePicker so
 *   the list can never drift between frontend and backend.
 *
 *   quality and batch_size are unconfirmed beyond the SDK's typed shape
 *   ('720p' | '1080p', 1 | 4) — kept as documented by the installed
 *   package's own .d.ts (node_modules/@higgsfield/client/dist/v2/types.d.ts).
 *
 *   Prompt length: a 32,000-character prompt (paired with an invalid
 *   width_and_height to keep the probe a free 422) produced no prompt-
 *   length error — capabilities.maxPromptLength below is 32000, matching
 *   OpenAI's confirmed ceiling, not guessed.
 */
const BASE_URL = "https://api.higgsfield.ai";
const SUBMIT_PATH = "/v1/text2image/soul";
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 45_000; // no background worker in this app — bound the wait so one slow attempt can't hang the whole request past typical serverless limits

interface HiggsfieldJob {
  id: string;
  status: "queued" | "processing" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | string;
  results: { min?: { url: string }; raw?: { url: string } } | null;
}
interface JobSetResponse {
  id: string;
  jobs: HiggsfieldJob[];
}

function authHeader(): string {
  return `Key ${process.env.HF_CREDENTIALS}`;
}

export class HiggsfieldImageProvider implements AIImageProvider {
  readonly id = "higgsfield-soul2";
  readonly label = "Higgsfield";
  readonly description = "Higgsfield Soul — phong cách sáng tạo, phù hợp ảnh marketing.";
  // maxReferenceImages: confirmed live — a 422 probe with a bad
  // image_reference.image_url returned a validation error specifically
  // on that field (not silently ignored), proving the schema recognizes
  // exactly one image_reference per request.
  readonly capabilities = {
    maxCount: 4,
    supportsBatchCount: false,
    supportsNegativePrompt: false,
    maxPromptLength: 32000,
    maxReferenceImages: 1,
    supportsAspectRatioResolution: false,
    supportsPromptEnhancement: false,
  };

  isConfigured(): boolean {
    return Boolean(process.env.HF_CREDENTIALS);
  }

  describeAdjustments(params: GenerateImageParams): string[] {
    const adjustments: string[] = [];
    if (params.negativePrompt.trim()) {
      adjustments.push("Higgsfield không hỗ trợ negative prompt — bỏ qua trường này.");
    }
    const requested = `${params.width}x${params.height}`;
    const nearest = nearestHiggsfieldSize(params.width, params.height).value;
    if (requested !== nearest) {
      adjustments.push(`Kích thước ${requested} không nằm trong preset Higgsfield hỗ trợ — dùng preset gần nhất ${nearest}.`);
    }
    return adjustments;
  }

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    if (!this.isConfigured()) throw new ProviderError("unavailable", "Higgsfield chưa được cấu hình API key.");

    const results: GeneratedImage[] = [];
    for (let i = 0; i < params.count; i++) {
      results.push(await this.generateOne(params));
    }
    return results;
  }

  private async generateOne(params: GenerateImageParams): Promise<GeneratedImage> {
    const jobSetId = await this.submit(params);
    const imageUrl = await this.pollUntilDone(jobSetId);
    return this.fetchAsImage(imageUrl, params);
  }

  private async submit(params: GenerateImageParams): Promise<string> {
    const widthAndHeight = nearestHiggsfieldSize(params.width, params.height).value;
    const quality = Math.max(params.width, params.height) >= 1600 ? "1080p" : "720p";

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${SUBMIT_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader() },
        body: JSON.stringify({
          params: {
            prompt: params.prompt,
            width_and_height: widthAndHeight,
            quality,
            batch_size: 1,
            enhance_prompt: false,
            ...(params.referenceImageUrl
              ? { image_reference: { type: "image_url", image_url: params.referenceImageUrl } }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new ProviderError("unavailable", `Không thể kết nối tới Higgsfield: ${(e as Error).message}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("unavailable", "Higgsfield từ chối xác thực — kiểm tra lại HF_CREDENTIALS.");
    }
    if (response.status === 429) throw new ProviderError("rate_limited", "Higgsfield đang giới hạn tốc độ (429).");
    if (response.status === 400 || response.status === 422) {
      const body = await response.json().catch(() => null);
      const detail = Array.isArray(body?.detail) ? body.detail.map((d: { msg?: string }) => d.msg).join("; ") : body?.detail;
      throw new ProviderError("invalid_request", detail || "Higgsfield từ chối yêu cầu không hợp lệ.");
    }
    if (!response.ok) throw new ProviderError("unavailable", `Higgsfield trả về lỗi HTTP ${response.status}.`);

    const data = (await response.json()) as Partial<JobSetResponse>;
    if (!data.id) {
      console.error("[Higgsfield submit] unexpected response shape", { keys: Object.keys(data ?? {}) });
      throw new ProviderError("unavailable", "Higgsfield không trả về id phiên tạo ảnh để theo dõi tiến trình.");
    }
    return data.id;
  }

  private async pollUntilDone(jobSetId: string): Promise<string> {
    const pollUrl = `${BASE_URL}/v1/job-sets/${jobSetId}`;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let response: Response;
      try {
        response = await fetch(pollUrl, {
          headers: { Authorization: authHeader() },
          signal: AbortSignal.timeout(10_000),
        });
      } catch (e) {
        throw new ProviderError("unavailable", `Mất kết nối khi theo dõi tiến trình Higgsfield (job ${jobSetId}): ${(e as Error).message}`);
      }
      if (!response.ok) throw new ProviderError("unavailable", `Higgsfield trả về lỗi HTTP ${response.status} khi poll (job ${jobSetId}).`);

      const data = (await response.json()) as Partial<JobSetResponse>;
      const job = data.jobs?.[0];
      if (!job) {
        console.error("[Higgsfield poll] response has no jobs[0]", { jobSetId, keys: Object.keys(data ?? {}) });
        throw new ProviderError("unavailable", `Higgsfield không trả về trạng thái hợp lệ cho job ${jobSetId}.`);
      }

      if (job.status === "completed") {
        const url = job.results?.raw?.url ?? job.results?.min?.url;
        if (!url) {
          console.error("[Higgsfield poll] completed but no results.raw/min.url", { jobSetId, resultKeys: job.results ? Object.keys(job.results) : null });
          throw new ProviderError("unavailable", `Higgsfield báo hoàn tất nhưng không trả về ảnh (job ${jobSetId}).`);
        }
        return url;
      }
      if (job.status === "nsfw") throw new ProviderError("content_policy", "Higgsfield từ chối do chính sách nội dung.");
      if (job.status === "failed" || job.status === "canceled") {
        throw new ProviderError("unavailable", `Higgsfield báo lỗi khi tạo ảnh (job ${jobSetId}, trạng thái: ${job.status}).`);
      }
      // queued/processing/in_progress — keep polling
    }

    throw new ProviderError("timeout", `Higgsfield không hoàn tất trong thời gian cho phép (job ${jobSetId}).`);
  }

  private async fetchAsImage(url: string, params: GenerateImageParams): Promise<GeneratedImage> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      throw new ProviderError("unavailable", `Không thể tải ảnh kết quả từ Higgsfield: ${(e as Error).message}`);
    }
    if (!response.ok) throw new ProviderError("unavailable", `Không thể tải ảnh kết quả (HTTP ${response.status}).`);

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());

    // Read the REAL pixel size from the downloaded bytes rather than
    // trusting the requested width/height — verified live that Higgsfield's
    // `raw` output matches width_and_height exactly, but this guards
    // against silently reporting a wrong size if that ever changes.
    const realDimensions = readImageDimensions(bytes);
    if (!realDimensions) {
      console.error("[Higgsfield fetchAsImage] could not read real dimensions from bytes — falling back to requested size", { contentType, byteLength: bytes.length });
    }

    return {
      bytes,
      contentType,
      width: realDimensions?.width ?? params.width,
      height: realDimensions?.height ?? params.height,
      isDemo: false,
    };
  }
}
