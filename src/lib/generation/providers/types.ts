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

export interface AIImageProvider {
  /** Machine-readable id stored in generation_jobs.provider, e.g. "demo". */
  readonly id: string;
  generateImages(params: GenerateImageParams): Promise<GeneratedImage[]>;
}
