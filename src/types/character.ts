import type { CharacterEthnicity, CharacterGender, CharacterView, GenerationAttempt } from "./database";

export type { CharacterEthnicity, CharacterGender, CharacterView, GenerationAttempt };
export type CharacterFaceSource = "upload" | "ai";

export const CHARACTER_MIN_AGE = 12;
export const CHARACTER_MAX_AGE = 80;
export const CHARACTER_DEFAULT_AGE = 22;

/** The full turnaround sequence a character sheet cycles through — a
 * sheet with `count` images uses the first `count` of these, in order.
 * "portrait" (close-up face) comes first, then the three full-body
 * angles — matches the product ask: "chân dung cận mặt và toàn thân
 * trước/nghiêng/sau". */
export const CHARACTER_VIEWS: CharacterView[] = ["portrait", "front", "side", "back"];

export const CHARACTER_VIEW_LABEL: Record<CharacterView, string> = {
  portrait: "Chân dung cận mặt",
  front: "Toàn thân chính diện",
  side: "Toàn thân nghiêng 3/4",
  back: "Toàn thân phía sau",
};

export const CHARACTER_GENDER_LABEL: Record<CharacterGender, string> = {
  male: "Nam",
  female: "Nữ",
};

export const CHARACTER_ETHNICITY_LABEL: Record<CharacterEthnicity, string> = {
  vietnamese: "Người Việt",
  asian: "Châu Á",
  european: "Châu Âu",
};

export interface Character {
  id: string;
  workspaceId: string;
  displayName: string;
  tagName: string;
  gender: CharacterGender;
  ethnicity: CharacterEthnicity;
  age: number;
  faceSource: CharacterFaceSource;
  /** Short-lived signed URL, resolved server-side on every read — never
   * persisted client-side beyond the current page load (same convention
   * as every other Storage-backed URL in this app). Null when the
   * underlying object can't be resolved (e.g. migration not applied yet,
   * or the row predates a successful upload). */
  faceUrl: string | null;
  faceLocked: boolean;
  consentConfirmed: boolean;
  createdAt: string;
}

export interface CharacterSheetViewItem {
  view: CharacterView;
  jobId: string;
  status: "queued" | "processing" | "succeeded" | "failed" | "cancelled";
  url: string | null;
  width: number | null;
  height: number | null;
  isDemo: boolean;
  savedAssetId: string | null;
  error: string | null;
  prompt: string;
  requestedModel: string | null;
  finalModel: string | null;
  /** Non-empty when the resolved model had to adjust the request (e.g.
   * "model này chưa hỗ trợ ảnh tham chiếu khuôn mặt") — surfaced as-is,
   * never hidden, per the product rule that adjustments are always shown. */
  attempts: GenerationAttempt[];
}

export interface CharacterSheet {
  sheetId: string;
  characterId: string;
  createdAt: string;
  views: CharacterSheetViewItem[];
}
