/**
 * Character Builder's "Ngoại hình" (appearance) presets — Kiểu tóc / Vóc
 * dáng / Biểu cảm. Plain data, client-only (composed into the existing
 * `appearanceDescription` string sent to generateCharacterFace()/
 * createCharacterSheet() — see composeAppearanceDescription() in
 * character-builder.tsx), so no schema/migration changes were needed to
 * add this. "natural" is the default/neutral pick in every category —
 * its phrase is "" (adds nothing to the prompt), for a user who doesn't
 * want to force a specific look beyond the locked face.
 */
export interface CharacterAppearanceOption {
  id: string;
  label: string;
  /** "" for "natural" — folds nothing into the prompt. */
  phrase: string;
}

export const HAIRSTYLE_OPTIONS: CharacterAppearanceOption[] = [
  { id: "natural", label: "Tự nhiên", phrase: "" },
  { id: "short_tidy", label: "Ngắn gọn gàng", phrase: "tóc ngắn gọn gàng" },
  { id: "side_swept", label: "Mái lệch", phrase: "tóc mái lệch" },
  { id: "undercut", label: "Undercut", phrase: "tóc undercut" },
  { id: "short_curly", label: "Tóc xoăn ngắn", phrase: "tóc xoăn ngắn" },
  { id: "long_tied", label: "Dài buộc sau", phrase: "tóc dài buộc sau" },
];

export const BODY_TYPE_OPTIONS: CharacterAppearanceOption[] = [
  { id: "natural", label: "Tự nhiên", phrase: "" },
  { id: "slim", label: "Mảnh khảnh", phrase: "vóc dáng mảnh khảnh" },
  { id: "balanced", label: "Cân đối", phrase: "vóc dáng cân đối" },
  { id: "tall_slender", label: "Cao ráo", phrase: "vóc dáng cao ráo" },
  { id: "athletic", label: "Khỏe khoắn", phrase: "vóc dáng khỏe khoắn, săn chắc" },
];

export const EXPRESSION_OPTIONS: CharacterAppearanceOption[] = [
  { id: "natural", label: "Tự nhiên", phrase: "" },
  { id: "calm", label: "Điềm tĩnh", phrase: "biểu cảm điềm tĩnh" },
  { id: "soft_smile", label: "Mỉm cười nhẹ", phrase: "biểu cảm mỉm cười nhẹ nhàng" },
  { id: "serious", label: "Nghiêm túc", phrase: "biểu cảm nghiêm túc" },
  { id: "confident", label: "Tự tin", phrase: "biểu cảm tự tin" },
];

export const DEFAULT_APPEARANCE_OPTION_ID = "natural";

export function appearancePhrase(options: CharacterAppearanceOption[], id: string): string {
  return options.find((o) => o.id === id)?.phrase ?? "";
}

export function appearanceLabel(options: CharacterAppearanceOption[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id;
}
