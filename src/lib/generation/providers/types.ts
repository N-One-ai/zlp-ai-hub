/**
 * AI image provider adapter — PRD §5/§12: "tách adapter AI generation...
 * để thay provider mà không viết lại luồng sản phẩm." Every provider
 * (demo or real) implements exactly this shape; nothing above this layer
 * (Server Action, UI) ever branches on which provider is active.
 */
export interface GenerateImageParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  /** How many variants to generate in one job (PRD §7.2: "số lượng biến
   * thể"). Kept small — this is a synchronous-per-request MVP, not a
   * batch queue. */
  count: number;
  brandContext?: {
    brandName: string;
    colors: string[]; // hex values, for providers that accept a palette hint
  };
  /** A signed, server-fetchable URL to a reference image — only sent to
   * models whose capabilities.maxReferenceImages is at least 1. Confirmed
   * real (not guessed) for Higgsfield Soul: a 422 probe with a
   * deliberately invalid image_reference.image_url returned a validation
   * error specifically on that field, proving the schema recognizes it. */
  referenceImageUrl?: string;
  /** Up to capabilities.maxReferenceImages signed URLs, ordered — for
   * models that accept more than one reference image (e.g. Marketing
   * Studio's enhance mode: index 0 is the required product image, index 1
   * an optional model/style reference). Supersedes referenceImageUrl for
   * those models; adapters that only ever take one image keep using the
   * singular field above. */
  referenceImageUrls?: string[];
  /** Aspect-ratio string (e.g. "4:3", "auto") — only used by models whose
   * capabilities.supportsAspectRatioResolution is true, instead of literal
   * width/height pixels. */
  aspectRatio?: string;
  /** Resolution tier — only used alongside aspectRatio above. */
  resolution?: "1k" | "2k" | "4k";
  /** Preset-based prompt rewriting — only used by models whose
   * capabilities.supportsPromptEnhancement is true. presetId must come
   * from that model's own live presets endpoint, never hardcoded. */
  enhancePrompt?: boolean;
  presetId?: string;
}

export interface GeneratedImage {
  /** Raw image bytes — the caller uploads this to Storage; a provider
   * never writes to Storage itself, keeping the adapter boundary clean. */
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
  /** True for the Demo Provider's placeholder output — the UI must always
   * show this distinction; PRD §15.item and §18: "Không tuyên bố sinh ảnh
   * thật nếu provider chưa được cấu hình." */
  isDemo: boolean;
}

/**
 * Error classification for the fallback orchestrator (see
 * src/lib/generation/actions.ts). `retryable` is what decides whether the
 * orchestrator advances to the next model in the fallback chain or stops
 * immediately — per the product rule: "Không tự động chuyển model khi
 * prompt/request không hợp lệ, hoặc khi provider từ chối vì chính sách
 * nội dung."
 */
export type ProviderErrorCode =
  | "unavailable" // provider/network down, 5xx, auth misconfigured
  | "timeout"
  | "rate_limited"
  | "quota_exceeded"
  | "invalid_request" // bad prompt/params — not retryable on another model
  | "content_policy"; // provider refused for content policy — not retryable

const NON_RETRYABLE_CODES: ReadonlySet<ProviderErrorCode> = new Set(["invalid_request", "content_policy"]);

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = !NON_RETRYABLE_CODES.has(code);
  }
}

export interface ModelCapabilities {
  /** Upper bound on `count` this model will accept in one job. */
  maxCount: number;
  /** True if the adapter can request N images in a single provider call
   * (e.g. OpenAI's `n`); false means the adapter loops `count` times
   * sequentially itself — callers never need to know which. */
  supportsBatchCount: boolean;
  /** False means a non-empty negativePrompt gets folded into the main
   * prompt text by the adapter (and recorded as an adjustment) rather
   * than sent as a dedicated field. */
  supportsNegativePrompt: boolean;
  /** Longest prompt (in characters) this model's API actually documents
   * support for — e.g. OpenAI's gpt-image-1 confirms 32000; providers
   * without a confirmed higher limit keep the app's own conservative
   * default (1000) rather than guessing a larger number. Mirrored in
   * src/lib/generation/model-meta.ts (MODEL_META) for client-side use —
   * keep both in sync when either changes. */
  maxPromptLength: number;
  /** 0 = no reference-image support at all. Otherwise the max number of
   * reference images this model's real API accepts in one request —
   * independently confirmed per model (never assumed from a typed SDK
   * that was already wrong elsewhere for this same endpoint). */
  maxReferenceImages: number;
  /** True only for models confirmed to take an aspect_ratio + resolution
   * tier (e.g. "4:3" + "2k") instead of literal width/height pixels —
   * tells the composer which size picker to render. */
  supportsAspectRatioResolution: boolean;
  /** True only for models with a confirmed preset-based prompt-enhancement
   * mode, where preset ids are fetched live and never hardcoded. */
  supportsPromptEnhancement: boolean;
}

export interface AIImageProvider {
  /** Machine-readable id stored in generation_jobs.model, e.g.
   * "gemini-nano-banana-pro". Stable — never renamed once shipped, since
   * past job rows reference it. */
  readonly id: string;
  /** Human label shown in the UI, e.g. "Nano Banana Pro". */
  readonly label: string;
  /** Short one-line description shown under the label in the picker. */
  readonly description: string;
  readonly capabilities: ModelCapabilities;
  /** True only when this adapter's required env var(s) are set. The UI
   * only ever lists models where this is true (PRD ask: "Mặc định chỉ
   * liệt kê các model đang được cấu hình và có thể sử dụng") — a model
   * with isConfigured() === false is never shown, never silently used. */
  isConfigured(): boolean;
  /** Adjustments made to the request to fit this model's real capabilities
   * (e.g. negative prompt folded into the prompt, count clamped). Called
   * by the orchestrator before generateImages() purely to log what will
   * happen — never used to silently change behavior without the caller
   * knowing. */
  describeAdjustments(params: GenerateImageParams): string[];
  generateImages(params: GenerateImageParams): Promise<GeneratedImage[]>;
}
