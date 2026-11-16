/** Built-in marquee text when a workspace has never configured one —
 * reuses the SAME tagline the static (no-banner) Dashboard hero already
 * shows, instead of inventing new marketing copy. */
export const DASHBOARD_MARQUEE_DEFAULT_TEXT = "Tạo nội dung marketing bằng AI, đúng thương hiệu";

export const DASHBOARD_MARQUEE_DEFAULT_SPEED_SECONDS = 40;
export const DASHBOARD_MARQUEE_DEFAULT_FONT_SIZE = "sm";
export const DASHBOARD_MARQUEE_DEFAULT_TEXT_STYLE = "solid";

/** A few safe speed presets for the admin UI — "chỉnh tốc độ trong một
 * khoảng an toàn", never a free-form number input. Lower seconds = one
 * loop completes faster = visually faster scroll. "Chậm" is deliberately
 * half the speed of (i.e. double the loop duration of) the original 60s
 * value, per explicit feedback that the old "Chậm" wasn't slow enough. */
export const DASHBOARD_MARQUEE_SPEED_PRESETS = [
  { value: 120, label: "Chậm" },
  { value: 40, label: "Vừa (mặc định)" },
  { value: 22, label: "Nhanh" },
] as const;

export const DASHBOARD_MARQUEE_FONT_SIZE_PRESETS = [
  { value: "sm", label: "Nhỏ (mặc định)" },
  { value: "md", label: "Vừa" },
  { value: "lg", label: "Lớn" },
] as const;

export const DASHBOARD_MARQUEE_TEXT_STYLE_PRESETS = [
  { value: "solid", label: "Chữ đặc (mặc định)" },
  { value: "stroke", label: "Chữ viền (outline)" },
] as const;
