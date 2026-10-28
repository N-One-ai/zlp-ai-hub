import type { AIImageProvider, GenerateImageParams, GeneratedImage } from "./types";
import { ProviderError } from "./types";

/**
 * Google Gemini 3 Pro Image — publicly branded "Nano Banana Pro". Verified
 * against docs.ai.google.dev / Vertex AI model docs (Oct 2026):
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *   header: x-goog-api-key: <GEMINI_API_KEY>
 *   body:   { contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["IMAGE"] } }
 *   image:  candidates[0].content.parts[].inlineData.{mimeType,data} (base64)
 *
 * The API has no documented per-call batch-count or negative-prompt
 * field, so this adapter loops `count` times and folds a non-empty
 * negativePrompt into the prompt text itself (see describeAdjustments —
 * the orchestrator logs this so it's never a silent behavior change).
 *
 * Prompt length: Google doesn't publish a hard character cap for this
 * model's text prompt — input is governed by its token context window
 * (far larger than any prompt a UI textarea would realistically produce;
 * 32,000 characters is only ~6-8k tokens). capabilities.maxPromptLength
 * is set to 32000 to match the app's verified global ceiling (OpenAI's
 * own documented limit, and confirmed live against Higgsfield too) —
 * this one is reasoned from the model's architecture, not independently
 * API-verified the way the other two were, since no GEMINI_API_KEY was
 * configured in this environment to test against.
 */
const MODEL_ID = "gemini-3-pro-image-preview";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  error?: { code?: number; status?: string; message?: string };
}

export class GeminiImageProvider implements AIImageProvider {
  readonly id = "gemini-nano-banana-pro";
  readonly label = "Nano Banana Pro";
  readonly description = "Gemini 3 Pro Image (Google) — chất lượng cao, hiểu prompt tiếng Việt tốt.";
  readonly capabilities = {
    maxCount: 4,
    supportsBatchCount: false,
    supportsNegativePrompt: false,
    maxPromptLength: 32000,
    maxReferenceImages: 0,
    supportsAspectRatioResolution: false,
    supportsPromptEnhancement: false,
  };

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  describeAdjustments(params: GenerateImageParams): string[] {
    const adjustments: string[] = [];
    if (params.negativePrompt.trim()) {
      adjustments.push("Negative prompt được gộp vào prompt chính (model không có tham số loại trừ riêng).");
    }
    if (params.referenceImageUrl) {
      adjustments.push("Gemini chưa được tích hợp hỗ trợ ảnh tham chiếu trong app này — bỏ qua ảnh đã chọn.");
    }
    return adjustments;
  }

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderError("unavailable", "GEMINI_API_KEY chưa được cấu hình.");

    const prompt = params.negativePrompt.trim()
      ? `${params.prompt}\n\nAvoid: ${params.negativePrompt.trim()}`
      : params.prompt;

    const results: GeneratedImage[] = [];
    for (let i = 0; i < params.count; i++) {
      results.push(await this.generateOne(apiKey, prompt, params));
    }
    return results;
  }

  private async generateOne(apiKey: string, prompt: string, params: GenerateImageParams): Promise<GeneratedImage> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new ProviderError("timeout", "Gemini không phản hồi kịp thời gian.");
      }
      throw new ProviderError("unavailable", `Không thể kết nối tới Gemini: ${(e as Error).message}`);
    }

    if (response.status === 429) throw new ProviderError("rate_limited", "Gemini đang giới hạn tốc độ (429).");
    if (response.status === 402 || response.status === 403) {
      throw new ProviderError("quota_exceeded", "Gemini từ chối do quota/billing.");
    }
    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      throw new ProviderError("invalid_request", body?.error?.message ?? "Gemini từ chối yêu cầu không hợp lệ.");
    }
    if (!response.ok) {
      throw new ProviderError("unavailable", `Gemini trả về lỗi HTTP ${response.status}.`);
    }

    const data: GeminiResponse = await response.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart?.inlineData) {
      // Gemini returns 200 with no image part when the prompt was blocked
      // by its own safety filter — this is a content-policy refusal, not
      // an infra failure, so it must NOT trigger fallback to another model.
      throw new ProviderError("content_policy", "Gemini từ chối tạo ảnh cho prompt này.");
    }

    return {
      bytes: Buffer.from(imagePart.inlineData.data, "base64"),
      contentType: imagePart.inlineData.mimeType || "image/png",
      width: params.width,
      height: params.height,
      isDemo: false,
    };
  }
}
