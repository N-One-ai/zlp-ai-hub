/**
 * Character Builder's "Trang phục" (outfit) suggested presets — plain
 * data, client-only. The selected preset's label is folded verbatim into
 * the `outfitDescription` string already accepted by createCharacterSheet()
 * (see character-actions.ts), same as the "Tự nhập" free-text mode — no
 * backend/schema change needed for this preset list.
 */
export interface CharacterOutfitPreset {
  id: string;
  label: string;
}

export const OUTFIT_PRESETS: CharacterOutfitPreset[] = [
  { id: "trench_turtleneck", label: "Măng tô xám + cổ lọ đen" },
  { id: "trench_olive", label: "Măng tô xanh rêu, lịch lãm" },
  { id: "suede_bandana", label: "Sơ mi da lộn + bandana" },
  { id: "cardigan_tie", label: "Cardigan đỏ rượu + cà vạt" },
  { id: "cardigan_navy", label: "Cardigan navy, học đường" },
  { id: "silk_midi", label: "Sơ mi lụa + chân váy midi" },
];

export const DEFAULT_OUTFIT_PRESET_ID = OUTFIT_PRESETS[0].id;

export function outfitPresetLabel(id: string): string {
  return OUTFIT_PRESETS.find((p) => p.id === id)?.label ?? id;
}
