import type { SafeZone } from "@/types/database";

const LOGO_HEIGHT_RATIO = 0.08;
const LOGO_MIN_HEIGHT_PX = 32;
const LOGO_MAX_HEIGHT_PX = 140;
const LOGO_MARGIN_FALLBACK_PX = 60;

export interface LogoBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Target position + height for the 5 reference banner sizes the user
 * supplied as ground truth (screenshots of the real Zalopay campaign
 * design), measured directly off those images. Width is deliberately
 * NOT part of this table — it is always derived from the logo's real
 * natural aspect ratio (see getDefaultLogoBox below), same as every
 * other size, so this calibration can never reintroduce the "stretched
 * logo" bug by pinning width and height independently.
 */
const CALIBRATED_LOGO_DEFAULTS: Record<string, { x: number; y: number; height: number }> = {
  "720x360": { x: 30, y: 29, height: 35 },
  "1080x360": { x: 28, y: 29, height: 35 },
  "1440x360": { x: 28, y: 29, height: 35 },
  "720x720": { x: 39, y: 40, height: 42 },
  "1200x1200": { x: 60, y: 61, height: 59 },
};

/**
 * Deterministic default logo box for a given canvas size, derived purely
 * from (canvasWidth, canvasHeight, aspect, safeZone) — never from
 * whichever preset the user happened to switch FROM. This is what makes
 * "mỗi preset có kích thước logo mặc định riêng" hold: visiting the same
 * preset twice always yields the same box, and it is computed in the
 * safe zone's top-left corner so the logo never drifts outside it.
 *
 * For the 5 calibrated sizes above, position + height come straight from
 * the reference design. For any other canvas size, height falls back to
 * a fraction of the canvas's shorter side (clamped to a sensible pixel
 * range). Either way, width is always derived from the real aspect ratio
 * — never set independently — so a logo can never come out stretched. If
 * the resulting width would overflow the safe area, the box is shrunk
 * (height recomputed from the capped width) rather than cropped, so the
 * ratio holds in every case.
 */
export function getDefaultLogoBox(canvasWidth: number, canvasHeight: number, naturalAspect: number, safeZone?: SafeZone | null): LogoBox {
  const aspect = naturalAspect > 0 ? naturalAspect : 1;
  const { topPx = LOGO_MARGIN_FALLBACK_PX, leftPx = LOGO_MARGIN_FALLBACK_PX, rightPx = LOGO_MARGIN_FALLBACK_PX } = safeZone ?? {};

  const calibrated = CALIBRATED_LOGO_DEFAULTS[`${canvasWidth}x${canvasHeight}`];
  const x = calibrated ? calibrated.x : leftPx;
  const y = calibrated ? calibrated.y : topPx;
  let height = calibrated ? calibrated.height : clamp(Math.min(canvasWidth, canvasHeight) * LOGO_HEIGHT_RATIO, LOGO_MIN_HEIGHT_PX, LOGO_MAX_HEIGHT_PX);
  let width = height * aspect;

  const maxWidth = Math.max(8, canvasWidth - x - rightPx);
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspect;
  }

  return {
    x,
    y,
    width: Math.round(width),
    height: Math.round(height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
