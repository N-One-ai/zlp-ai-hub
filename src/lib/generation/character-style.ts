/**
 * Character Builder's "Phong cách" (style) presets — plain data, no
 * secrets, safe to import from both the client (for the picker UI) and
 * character-actions.ts (server, for prompt assembly) so the two never
 * drift apart. Every option here is folded VERBATIM into the real prompt
 * sent to generateImages() — none of these are UI-only placeholders with
 * no effect on the actual request (see buildCharacterSheetPrompt in
 * character-actions.ts).
 */
export type CharacterStyleId = "photo" | "illustration" | "cartoon" | "cinematic" | "editorial" | "custom";

export interface CharacterStylePreset {
  id: CharacterStyleId;
  label: string;
  /** "" for "custom" — the user's own free-text description is used
   * instead, see resolveStylePromptText(). */
  promptPhrase: string;
}

export const CHARACTER_STYLE_PRESETS: CharacterStylePreset[] = [
  { id: "photo", label: "Ảnh thật", promptPhrase: "phong cách ảnh chụp chân thực, chi tiết cao, ánh sáng tự nhiên" },
  { id: "illustration", label: "Minh họa", promptPhrase: "phong cách minh họa kỹ thuật số, nét vẽ rõ ràng, màu sắc tươi sáng" },
  { id: "cartoon", label: "Hoạt hình", promptPhrase: "phong cách hoạt hình 2D, đường nét đơn giản, màu phẳng, không chi tiết da thực tế" },
  { id: "cinematic", label: "Điện ảnh", promptPhrase: "phong cách điện ảnh, ánh sáng kịch tính tương phản cao, tông màu phim" },
  { id: "editorial", label: "Thời trang / Editorial", promptPhrase: "phong cách ảnh thời trang editorial cao cấp, bố cục tạp chí, tạo dáng chuyên nghiệp" },
  { id: "custom", label: "Tùy chỉnh", promptPhrase: "" },
];

export const DEFAULT_CHARACTER_STYLE: CharacterStyleId = "photo";

export function characterStyleLabel(id: CharacterStyleId): string {
  return CHARACTER_STYLE_PRESETS.find((p) => p.id === id)?.label ?? id;
}

/** The actual phrase folded into the prompt — the matching preset's
 * phrase, or the user's own trimmed text for "custom" (falls back to the
 * "photo" preset's phrase if "custom" was picked but left empty, so a
 * blank custom field never silently drops style guidance). */
export function resolveStylePromptText(style: CharacterStyleId, customStyle: string): string {
  if (style === "custom") {
    const trimmed = customStyle.trim();
    return trimmed || CHARACTER_STYLE_PRESETS.find((p) => p.id === "photo")!.promptPhrase;
  }
  return CHARACTER_STYLE_PRESETS.find((p) => p.id === style)?.promptPhrase ?? "";
}
