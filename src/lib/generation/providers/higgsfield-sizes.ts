/**
 * Higgsfield Soul (`/v1/text2image/soul`) size catalog — the single
 * source of truth for both the UI (HiggsfieldSizePicker) and the server
 * (higgsfield-provider.ts, generateImages() in actions.ts), so the list
 * can never drift between frontend and backend.
 *
 * Every value here was confirmed by calling the REAL API directly (not
 * read from docs, which turned out stale/wrong for this endpoint): a
 * request with an intentionally-invalid width_and_height returns a 422
 * whose validation error enumerates the exact accepted set. No other
 * parameter shape (aspect_ratio, resolution tier, etc.) is documented or
 * accepted by this endpoint — width_and_height is the only size knob.
 *
 * This is the only Higgsfield model currently integrated in this app —
 * "các model Higgsfield" in the plural doesn't yet apply; if a second
 * Higgsfield model/endpoint is added later, it needs its own catalog
 * (its accepted values are not assumed to match this one).
 */
export interface HiggsfieldSizeOption {
  /** Exact string sent as width_and_height in the request body. */
  value: string;
  width: number;
  height: number;
  /** A clean "A:B" ratio when one exists at a small whole-number scale;
   * null for the two entries whose ratio doesn't reduce to one (960x1696,
   * 1696x960) — shown as "Khác" rather than asserting an inexact ratio. */
  ratioLabel: string | null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function makeOption(width: number, height: number): HiggsfieldSizeOption {
  const d = gcd(width, height);
  const rw = width / d;
  const rh = height / d;
  const clean = rw <= 32 && rh <= 32;
  return { value: `${width}x${height}`, width, height, ratioLabel: clean ? `${rw}:${rh}` : null };
}

export const HIGGSFIELD_SIZE_OPTIONS: HiggsfieldSizeOption[] = [
  makeOption(1152, 2048),
  makeOption(2048, 1152),
  makeOption(2048, 1536),
  makeOption(1536, 2048),
  makeOption(1344, 2016),
  makeOption(2016, 1344),
  makeOption(960, 1696),
  makeOption(1536, 1536),
  makeOption(1536, 1152),
  makeOption(1696, 960),
  makeOption(1152, 1536),
  makeOption(1088, 1632),
  makeOption(1632, 1088),
  makeOption(1120, 1680),
  makeOption(1680, 1120),
  makeOption(2048, 2048),
];

export const DEFAULT_HIGGSFIELD_SIZE = HIGGSFIELD_SIZE_OPTIONS.find((o) => o.value === "2048x2048")!;

export function higgsfieldSizeLabel(option: HiggsfieldSizeOption): string {
  const dims = `${option.width}×${option.height}px`;
  return option.ratioLabel ? `${option.ratioLabel} — ${dims}` : `Khác — ${dims}`;
}

/** Picks the catalog entry closest in aspect ratio to the given
 * width/height (log-ratio distance, same approach used server-side in
 * higgsfield-provider.ts) — reused when switching INTO Higgsfield from
 * another model/preset, so the auto-picked default tracks the user's
 * prior intent instead of always resetting to a fixed default. */
export function nearestHiggsfieldSize(width: number, height: number): HiggsfieldSizeOption {
  const targetRatio = width / height;
  let best = HIGGSFIELD_SIZE_OPTIONS[0];
  let bestScore = Infinity;
  for (const option of HIGGSFIELD_SIZE_OPTIONS) {
    const score = Math.abs(Math.log(option.width / option.height) - Math.log(targetRatio));
    if (score < bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best;
}

export function findHiggsfieldSize(value: string): HiggsfieldSizeOption | undefined {
  return HIGGSFIELD_SIZE_OPTIONS.find((o) => o.value === value);
}
