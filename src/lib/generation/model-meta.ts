/**
 * Plain, env-free model metadata — safe to import from Client Components
 * (ModelPicker, JobStatus) for rendering labels. The env-aware
 * availability check (listAvailableModels()) stays server-only in
 * providers/index.ts and is passed down as a prop, same pattern as
 * brands/presets elsewhere in this app.
 */
export interface ModelMeta {
  id: string;
  label: string;
  description: string;
  /** Mirrors the same model's adapter in providers/*.ts
   * (capabilities.maxPromptLength) — keep both in sync when either
   * changes. Used client-side to size the prompt character counter and
   * disable submit before a request is ever sent. */
  maxPromptLength: number;
  /** Mirrors capabilities.maxReferenceImages — 0 disables the Reference/
   * Elements controls entirely; 1 or 2 caps how many can be attached. */
  maxReferenceImages: number;
  /** Mirrors capabilities.supportsAspectRatioResolution — true shows the
   * aspect-ratio + resolution picker instead of the generic size preset
   * picker. */
  supportsAspectRatioResolution: boolean;
  /** Mirrors capabilities.supportsPromptEnhancement — true shows the
   * Enhance toggle + live preset picker. */
  supportsPromptEnhancement: boolean;
}

export const AUTO_MODEL_ID = "auto";

/** Conservative fallback when a model has no confirmed higher limit —
 * this is the app's own ceiling, not derived from any provider's docs. */
export const DEFAULT_MAX_PROMPT_LENGTH = 1000;

/** None of the 3 real models expose a dedicated negative-prompt field
 * (see each provider's describeAdjustments — it's folded into the main
 * prompt or dropped), so this is purely the app's own schema limit
 * (mirrors schema.ts's negativePrompt.max), not a per-model value. */
export const MAX_NEGATIVE_PROMPT_LENGTH = 500;

export const MODEL_META: ModelMeta[] = [
  {
    id: "gemini-nano-banana-pro",
    label: "Nano Banana Pro",
    description: "Gemini 3 Pro Image (Google) — chất lượng cao, hiểu prompt tiếng Việt tốt.",
    maxPromptLength: 32000,
    maxReferenceImages: 0,
    supportsAspectRatioResolution: false,
    supportsPromptEnhancement: false,
  },
  {
    id: "higgsfield-soul2",
    label: "Higgsfield",
    description: "Higgsfield Soul 2 — phong cách sáng tạo, phù hợp ảnh marketing.",
    maxPromptLength: 32000,
    maxReferenceImages: 1,
    supportsAspectRatioResolution: false,
    supportsPromptEnhancement: false,
  },
  {
    id: "higgsfield-marketing-studio",
    label: "Higgsfield Marketing Studio",
    description: "Tạo/chỉnh ảnh chiến dịch marketing tới 4K, hỗ trợ preset và ảnh sản phẩm tham chiếu.",
    maxPromptLength: 32000,
    maxReferenceImages: 2,
    supportsAspectRatioResolution: true,
    supportsPromptEnhancement: true,
  },
  {
    id: "openai-chatgpt",
    label: "ChatGPT",
    // 32000 confirmed in OpenAI's own API reference for gpt-image models — not a guess.
    description: "OpenAI gpt-image — nhanh, phổ biến, tốt cho ảnh sản phẩm/bố cục rõ ràng.",
    maxPromptLength: 32000,
    maxReferenceImages: 0,
    supportsAspectRatioResolution: false,
    supportsPromptEnhancement: false,
  },
  {
    id: "demo",
    label: "Demo (chưa cấu hình AI thật)",
    description: "Ảnh minh hoạ, dùng khi chưa có model AI nào được cấu hình.",
    maxPromptLength: 32000,
    maxReferenceImages: 0,
    supportsAspectRatioResolution: false,
    supportsPromptEnhancement: false,
  },
];

export function modelLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return MODEL_META.find((m) => m.id === id)?.label ?? id;
}

/**
 * The prompt-length ceiling to show/enforce client-side for the current
 * model picker value — single source of truth for both the character
 * counter and the submit-disable check, so frontend and backend can
 * never drift apart (the backend's own check in actions.ts reads the
 * SAME capabilities.maxPromptLength off the provider adapter).
 *
 * For a specific model, looks it up in `configuredModels` FIRST (the
 * server-resolved, always-current list passed down as a prop — see
 * listAvailableModels() in providers/index.ts) and only falls back to
 * the static MODEL_META table (for display purposes, e.g. labeling a
 * past job's requestedModel that's no longer configured). Looking up
 * `configuredModels` first, rather than only the static table, is what
 * guarantees this never silently drifts from the real provider capability.
 *
 * For "auto", the SMALLEST limit among the currently configured models
 * (any of them might end up being tried first in the fallback chain), so
 * the UI never lets the user type something that's valid for one model
 * but guaranteed to be rejected by another in the same chain.
 */
export function effectiveMaxPromptLength(modelId: string, configuredModels: ModelMeta[]): number {
  if (modelId !== AUTO_MODEL_ID) {
    const found = configuredModels.find((m) => m.id === modelId) ?? MODEL_META.find((m) => m.id === modelId);
    return found?.maxPromptLength ?? DEFAULT_MAX_PROMPT_LENGTH;
  }
  if (configuredModels.length === 0) return DEFAULT_MAX_PROMPT_LENGTH;
  return Math.min(...configuredModels.map((m) => m.maxPromptLength));
}
