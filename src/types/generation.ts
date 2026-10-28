import type { GenerationAttempt, GenerationJobStatus } from "./database";

export type { GenerationAttempt };

export interface GenerationResultItem {
  index: number;
  url: string | null;
  width: number;
  height: number;
  isDemo: boolean;
  /** Set once this specific output has been saved into the library, so
   * the UI can show "Đã lưu" instead of letting it be saved twice. */
  savedAssetId: string | null;
}

export interface GenerationJob {
  id: string;
  brandId: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  count: number;
  provider: string;
  requestedModel: string;
  finalModel: string | null;
  attempts: GenerationAttempt[];
  status: GenerationJobStatus;
  error: string | null;
  results: GenerationResultItem[];
  createdAt: string;
}
