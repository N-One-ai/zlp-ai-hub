/**
 * Single source of truth for the Dashboard hero banner's actual frame
 * shape — imported by the real carousel (banner-slide.tsx), the form's
 * live preview, and the focal-point pickers, so none of them can drift
 * out of sync with what the Dashboard really renders.
 *
 * The frame is deliberately given a FIXED aspect ratio per breakpoint
 * (rather than letting it stretch to match the sibling "Tạo ảnh"/"Tạo
 * banner" cards' height, which varies with viewport width and is not a
 * stable ratio to recommend an image against) — this is what makes "tỷ lệ
 * ảnh khuyến nghị" an honest, exact statement instead of a guess.
 */
export const DASHBOARD_BANNER_FRAME = {
  desktop: {
    ratioLabel: "2:1",
    widthRatio: 2,
    heightRatio: 1,
    recommendedWidth: 1600,
    recommendedHeight: 800,
    /** Container-query class (keyed to the slide's OWN rendered width, not
     * the viewport — a `sm:` viewport breakpoint would stay stuck at the
     * mobile ratio inside any narrower column, such as the form's
     * side-by-side live preview, even on a wide screen) applied from
     * `@sm` (24rem ≈ 384px) up. */
    aspectClass: "@sm:aspect-[2/1]",
    /** Non-responsive version, always this ratio — for the focal-point
     * picker, which is its own fixed-ratio box regardless of dialog width. */
    bareAspectClass: "aspect-[2/1]",
  },
  mobile: {
    ratioLabel: "4:3",
    widthRatio: 4,
    heightRatio: 3,
    recommendedWidth: 1200,
    recommendedHeight: 900,
    /** Applied below `@sm` — already non-responsive-prefixed, so it also
     * doubles as the bare class for the mobile focal-point picker. */
    aspectClass: "aspect-[4/3]",
    bareAspectClass: "aspect-[4/3]",
  },
} as const;

export type BannerFrameVariant = keyof typeof DASHBOARD_BANNER_FRAME;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reduces a pixel size to a small, human-readable ratio (e.g. 1920×960 →
 * "2:1"), capping at a reasonable denominator so odd photo dimensions
 * don't produce an unreadable ratio like "167:89". */
export function simplifyRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "—";
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  if (w <= 50 && h <= 50) return `${w}:${h}`;
  // Fall back to a decimal ratio against 1 for anything that doesn't
  // reduce to small whole numbers.
  return `${(width / height).toFixed(2)}:1`;
}

export interface ImageFitWarning {
  level: "error" | "warning";
  message: string;
}

/** Checks an uploaded image's natural size against one frame variant —
 * used right after upload to warn (never block) about a mismatch that
 * could crop out important content or look blurry when stretched. */
export function checkImageFit(
  width: number,
  height: number,
  variant: BannerFrameVariant
): ImageFitWarning[] {
  const frame = DASHBOARD_BANNER_FRAME[variant];
  const warnings: ImageFitWarning[] = [];
  const targetRatio = frame.widthRatio / frame.heightRatio;
  const actualRatio = width / height;
  const ratioDeviation = Math.abs(actualRatio - targetRatio) / targetRatio;

  if (ratioDeviation > 0.25) {
    warnings.push({
      level: "warning",
      message: `Tỷ lệ ảnh (${simplifyRatio(width, height)}) khác nhiều so với khung khuyến nghị (${frame.ratioLabel}) — phần rìa ảnh sẽ bị cắt khi phủ khung. Kéo điểm focus bên dưới để giữ đúng phần quan trọng.`,
    });
  } else if (ratioDeviation > 0.08) {
    warnings.push({
      level: "warning",
      message: `Tỷ lệ ảnh (${simplifyRatio(width, height)}) hơi khác khung khuyến nghị (${frame.ratioLabel}) — một phần nhỏ hai cạnh có thể bị cắt.`,
    });
  }

  if (width < frame.recommendedWidth * 0.6 || height < frame.recommendedHeight * 0.6) {
    warnings.push({
      level: "error",
      message: `Ảnh khá nhỏ (${width}×${height} px) so với khuyến nghị (${frame.recommendedWidth}×${frame.recommendedHeight} px) — có thể bị mờ khi hiển thị full khung.`,
    });
  } else if (width < frame.recommendedWidth || height < frame.recommendedHeight) {
    warnings.push({
      level: "warning",
      message: `Ảnh nhỏ hơn khuyến nghị (${frame.recommendedWidth}×${frame.recommendedHeight} px) — vẫn dùng được nhưng nên dùng ảnh lớn hơn trên màn hình lớn.`,
    });
  }

  return warnings;
}
