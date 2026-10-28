import type { AIImageProvider, GenerateImageParams, GeneratedImage } from "./types";
import { ProviderError } from "./types";

/**
 * OpenAI Images API ("ChatGPT" in product copy). Verified against
 * developers.openai.com/api/docs/guides/image-generation (Oct 2026):
 *   POST https://api.openai.com/v1/images/generations
 *   header: Authorization: Bearer <OPENAI_API_KEY>
 *   body:   { model, prompt, n, size, output_format }
 *   image:  data[].b64_json
 *
 * The live docs page showed model ids that look like preview codenames
 * ("gpt-image-2.5-sunburst"/"-flare") which couldn't be cross-confirmed
 * against a second source — OPENAI_IMAGE_MODEL defaults to the
 * long-established "gpt-image-1" and is overridable via env var without
 * a code change if that default is wrong by the time this runs.
 */
const ENDPOINT = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-image-1";
const SUPPORTED_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536"]);

interface OpenAIResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string; code?: string; type?: string };
}

function nearestSupportedSize(width: number, height: number): string {
  if (SUPPORTED_SIZES.has(`${width}x${height}`)) return `${width}x${height}`;
  if (width === height) return "1024x1024";
  return width > height ? "1536x1024" : "1024x1536";
}

export class OpenAIImageProvider implements AIImageProvider {
  readonly id = "openai-chatgpt";
  readonly label = "ChatGPT";
  readonly description = "OpenAI gpt-image — nhanh, phổ biến, tốt cho ảnh sản phẩm/bố cục rõ ràng.";
  // 32000 chars confirmed in OpenAI's own API reference for gpt-image models
  // (vs. 1000 for dall-e-2, 4000 for dall-e-3) — not a guess.
  readonly capabilities = {
    maxCount: 4,
    supportsBatchCount: true,
    supportsNegativePrompt: false,
    maxPromptLength: 32000,
    maxReferenceImages: 0,
    supportsAspectRatioResolution: false,
    supportsPromptEnhancement: false,
  };

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  describeAdjustments(params: GenerateImageParams): string[] {
    const adjustments: string[] = [];
    if (params.negativePrompt.trim()) {
      adjustments.push("ChatGPT không hỗ trợ negative prompt — bỏ qua trường này.");
    }
    const exact = `${params.width}x${params.height}`;
    const nearest = nearestSupportedSize(params.width, params.height);
    if (exact !== nearest) {
      adjustments.push(`Kích thước ${exact} không được hỗ trợ — dùng kích thước gần nhất ${nearest}.`);
    }
    if (params.referenceImageUrl) {
      adjustments.push("ChatGPT chưa được tích hợp hỗ trợ ảnh tham chiếu trong app này — bỏ qua ảnh đã chọn.");
    }
    return adjustments;
  }

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ProviderError("unavailable", "OPENAI_API_KEY chưa được cấu hình.");

    const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
    const size = nearestSupportedSize(params.width, params.height);

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt: params.prompt, n: params.count, size, output_format: "png" }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new ProviderError("timeout", "OpenAI không phản hồi kịp thời gian.");
      }
      throw new ProviderError("unavailable", `Không thể kết nối tới OpenAI: ${(e as Error).message}`);
    }

    if (response.status === 429) {
      const body: OpenAIResponse = await response.json().catch(() => ({}));
      const isQuota = body.error?.code === "insufficient_quota";
      throw new ProviderError(isQuota ? "quota_exceeded" : "rate_limited", body.error?.message ?? "OpenAI giới hạn tốc độ/quota.");
    }
    if (response.status === 400) {
      const body: OpenAIResponse = await response.json().catch(() => ({}));
      const isContentPolicy = body.error?.code === "content_policy_violation" || body.error?.type === "image_generation_user_error";
      throw new ProviderError(
        isContentPolicy ? "content_policy" : "invalid_request",
        body.error?.message ?? "OpenAI từ chối yêu cầu."
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("unavailable", "OpenAI từ chối xác thực — kiểm tra lại API key.");
    }
    if (!response.ok) {
      throw new ProviderError("unavailable", `OpenAI trả về lỗi HTTP ${response.status}.`);
    }

    const data: OpenAIResponse = await response.json();
    const items = data.data ?? [];
    if (items.length === 0) throw new ProviderError("unavailable", "OpenAI không trả về ảnh nào.");

    return items.map((item) => {
      if (!item.b64_json) throw new ProviderError("unavailable", "OpenAI trả về kết quả không hợp lệ.");
      return {
        bytes: Buffer.from(item.b64_json, "base64"),
        contentType: "image/png",
        width: params.width,
        height: params.height,
        isDemo: false,
      };
    });
  }
}
