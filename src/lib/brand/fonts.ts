/**
 * Curated, license-safe font list for Phase 1 — a dropdown of common
 * Google Fonts / web-safe families, not a font FILE upload. PRD §16 flags
 * font licensing as a real risk ("chỉ cho tải font được phép"); the
 * simplest safe answer for Phase 1 is to not accept arbitrary font files
 * at all yet, only let an Admin pick from this known-licensed list. Each
 * entry also carries a CSS-safe fallback, shown in the editor and used
 * wherever a font fails to load at render/export time.
 */
export const AVAILABLE_FONTS: { family: string; fallback: string }[] = [
  { family: "Inter", fallback: "sans-serif" },
  { family: "Roboto", fallback: "sans-serif" },
  { family: "Open Sans", fallback: "sans-serif" },
  { family: "Montserrat", fallback: "sans-serif" },
  { family: "Poppins", fallback: "sans-serif" },
  { family: "Lato", fallback: "sans-serif" },
  { family: "Playfair Display", fallback: "serif" },
  { family: "Merriweather", fallback: "serif" },
  { family: "Source Code Pro", fallback: "monospace" },
];
