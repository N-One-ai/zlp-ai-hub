import type { VoiceGenerationJobStatus } from "./database";

export interface VbeeVoice {
  code: string;
  name: string;
  gender: "male" | "female" | string;
  languageCode: string;
  /** Sample audio URL from Vbee's own CDN — not our Storage, never
   * downloaded/persisted, only used for an in-UI preview of the voice
   * itself before generating anything. */
  demoUrl: string | null;
}

/** The 5 voices Vbee's Realtime (sync) API actually accepts today — per
 * api-docs.vbee.vn/vbee-api/text-to-speech/realtime-api: "Hiện chỉ hỗ trợ
 * giọng HN - Ngọc Huyền, SG - Tường Vy, HN - Mai Phương, SG - Lan Trinh,
 * SG - Thảo Trinh". Matched by voice CODE (not name) since the full
 * voices list can contain more than one code per display name (see the
 * two "SG - Thảo Trinh" codes in the docs' own example response) — only
 * these exact codes are actually sync-eligible. Any other voice always
 * goes through the Batch (async) API, regardless of text length. */
export const VBEE_SYNC_VOICE_CODES = [
  "hn_female_ngochuyen_full_48k-fhg",
  "sg_female_tuongvy_call_44k-fhg",
  "hn_female_maiphuong_vdts_48k-fhg",
  "sg_female_lantrinh_vdts_48k-fhg",
  "sg_female_thaotrinh_full_48k-fhg",
] as const;

export const VBEE_SYNC_MAX_CHARS = 300;
export const VBEE_BATCH_MAX_CHARS = 100_000;
export const VBEE_VALID_BITRATES = [8, 16, 32, 64, 128] as const;
export const VBEE_OUTPUT_FORMATS = ["mp3", "wav"] as const;

/** Cap for the "Nghe thử" fallback path (previewVoiceSampleAction) — only
 * used when a voice has no `demoUrl` from Vbee. Kept well under
 * VBEE_SYNC_MAX_CHARS so a preview is always cheap/fast, never the cost
 * of a real generation. */
export const VBEE_PREVIEW_SAMPLE_MAX_CHARS = 150;

export interface VoiceGenerationJob {
  id: string;
  text: string;
  voiceCode: string;
  voiceName: string;
  mode: "sync" | "async";
  outputFormat: "mp3" | "wav";
  bitrate: number;
  speed: number;
  status: VoiceGenerationJobStatus;
  error: string | null;
  /** Signed URL to the job's OWN stored file (never Vbee's short-lived
   * audio_link/audioLink) — present only once status is 'succeeded'. */
  audioUrl: string | null;
  /** Set once this job's audio has been registered as a creative_assets
   * row via "Lưu vào Thư viện" — lets the UI show "Đã lưu" instead of
   * letting the same job be saved twice. */
  savedAssetId: string | null;
  createdAt: string;
}
