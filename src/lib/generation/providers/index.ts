import type { AIImageProvider } from "./types";
import { DemoImageProvider } from "./demo-provider";
import { GeminiImageProvider } from "./gemini-provider";
import { HiggsfieldImageProvider } from "./higgsfield-provider";
import { MarketingStudioImageProvider } from "./marketing-studio-provider";
import { OpenAIImageProvider } from "./openai-provider";

/**
 * The full model registry — every adapter this app knows how to call,
 * real or demo. Each one declares its own isConfigured() (reads its own
 * server-only env var(s); never read here) so this file stays a pure
 * lookup table, not a place that duplicates env logic.
 */
const REGISTRY: AIImageProvider[] = [
  new GeminiImageProvider(),
  new HiggsfieldImageProvider(),
  new MarketingStudioImageProvider(),
  new OpenAIImageProvider(),
  new DemoImageProvider(),
];

const DEMO = REGISTRY.find((p) => p.id === "demo")!;

/**
 * Default fallback order among REAL models only — "ưu tiên → dự phòng 1 →
 * dự phòng 2" per the product spec. Overridable via AI_FALLBACK_ORDER
 * (comma-separated ids) without a code change. Demo is deliberately never
 * part of this chain: it must never silently replace a failed real
 * attempt, only ever appear when the user has zero real models
 * configured at all (see listAvailableModels()).
 */
// Marketing Studio is deliberately NOT in this list: it's selected
// explicitly (its own composer controls — aspect ratio, resolution,
// preset enhancement), never silently substituted by "auto"/fallback,
// since approximating its aspect_ratio+resolution params from another
// model's pixel width/height would be a guess, not a confirmed mapping.
const CODE_DEFAULT_FALLBACK_ORDER = ["gemini-nano-banana-pro", "higgsfield-soul2", "openai-chatgpt"];

function fallbackOrder(): string[] {
  const envOrder = process.env.AI_FALLBACK_ORDER;
  if (!envOrder) return CODE_DEFAULT_FALLBACK_ORDER;
  return envOrder
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getModel(id: string): AIImageProvider {
  const model = REGISTRY.find((p) => p.id === id);
  if (!model) throw new Error(`Unknown model id: ${id}`);
  return model;
}

/** Server-only — reads env vars via each adapter's isConfigured(). Pass
 * the result down as a prop into Client Components; never import this
 * file's REGISTRY directly from the client. */
export function listAvailableModels(): AIImageProvider[] {
  return REGISTRY.filter((p) => p.id !== "demo" && p.isConfigured());
}

/**
 * The ordered chain of model ids the orchestrator should try, for a given
 * user request. `requestedModel` of "auto" (or any id that isn't
 * actually configured) falls through to the configured default order; a
 * specific configured model is tried first, then the remaining configured
 * fallbacks after it — exactly "ưu tiên → dự phòng 1 → dự phòng 2".
 *
 * Returns an empty array when nothing real is configured — the caller
 * (generateImages in actions.ts) falls back to the Demo Provider only in
 * that case, never silently substituting Demo after a real attempt fails.
 */
export function resolveModelChain(requestedModel: string): string[] {
  const configuredIds = new Set(listAvailableModels().map((p) => p.id));
  const order = fallbackOrder().filter((id) => configuredIds.has(id));

  if (requestedModel === "auto" || !configuredIds.has(requestedModel)) return order;
  return [requestedModel, ...order.filter((id) => id !== requestedModel)];
}

export function getDemoModel(): AIImageProvider {
  return DEMO;
}
