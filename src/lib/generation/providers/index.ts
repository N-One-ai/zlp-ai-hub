import type { AIImageProvider } from "./types";
import { DemoImageProvider } from "./demo-provider";

/**
 * The extension point for a real AI image provider (Task 3.4 — scaffold
 * only, intentionally not implemented). PRD §17 left the AI provider
 * unspecified; rather than guess and wire up a paid API without explicit
 * approval, this factory always returns the Demo Provider today.
 *
 * To add a real provider later: implement AIImageProvider (see
 * ./types.ts) in a new file here, read its API key from a server-only
 * env var (NEVER NEXT_PUBLIC_*), and return it from this factory when
 * that env var is set — e.g.:
 *
 *   const apiKey = process.env.AI_PROVIDER_API_KEY;
 *   if (apiKey) return new RealProvider(apiKey);
 *   return new DemoImageProvider();
 *
 * This machine already has the Higgsfield CLI available (used by the
 * sibling ZaloPay AI Creative Platform project) — a plausible real
 * provider to wire in here, but not done without being asked, since it
 * wasn't part of this PRD's specified scope.
 */
export function getImageProvider(): AIImageProvider {
  return new DemoImageProvider();
}
