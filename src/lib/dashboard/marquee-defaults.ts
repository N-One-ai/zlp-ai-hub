/** Built-in marquee text when a workspace has never configured one —
 * reuses the SAME tagline the static (no-banner) Dashboard hero already
 * shows, instead of inventing new marketing copy. */
export const DASHBOARD_MARQUEE_DEFAULT_TEXT = "Tạo nội dung marketing bằng AI, đúng thương hiệu";

export const DASHBOARD_MARQUEE_DEFAULT_SPEED_SECONDS = 40;

/** A few safe speed presets for the admin UI — "chỉnh tốc độ trong một
 * khoảng an toàn", never a free-form number input. Lower seconds = one
 * loop completes faster = visually faster scroll. */
export const DASHBOARD_MARQUEE_SPEED_PRESETS = [
  { value: 60, label: "Chậm" },
  { value: 40, label: "Vừa (mặc định)" },
  { value: 22, label: "Nhanh" },
] as const;
