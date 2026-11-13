import { z } from "zod";
import { VBEE_BATCH_MAX_CHARS, VBEE_VALID_BITRATES, VBEE_OUTPUT_FORMATS, VBEE_PREVIEW_SAMPLE_MAX_CHARS } from "@/types/voice";

export const createVoiceGenerationSchema = z.object({
  brandId: z.string().uuid(),
  text: z
    .string()
    .trim()
    .min(1, "Văn bản không được để trống.")
    .max(VBEE_BATCH_MAX_CHARS, `Văn bản quá dài — tối đa ${VBEE_BATCH_MAX_CHARS.toLocaleString("vi-VN")} ký tự.`),
  voiceCode: z.string().trim().min(1, "Cần chọn giọng đọc."),
  voiceName: z.string().trim().max(200).default(""),
  outputFormat: z.enum(VBEE_OUTPUT_FORMATS).default("mp3"),
  bitrate: z
    .number()
    .int()
    .refine((v): v is (typeof VBEE_VALID_BITRATES)[number] => (VBEE_VALID_BITRATES as readonly number[]).includes(v), {
      message: "Bitrate không hợp lệ.",
    })
    .default(128),
  speed: z.number().min(0.25, "Tốc độ tối thiểu 0.25.").max(1.9, "Tốc độ tối đa 1.9.").default(1.0),
  sampleRate: z
    .number()
    .int()
    .refine((v) => [8000, 16000, 22050, 24000, 32000, 44100, 48000].includes(v), { message: "Sample rate không hợp lệ." })
    .optional(),
});
export type CreateVoiceGenerationInput = z.infer<typeof createVoiceGenerationSchema>;

export const saveVoiceAssetSchema = z.object({
  jobId: z.string().uuid(),
  name: z.string().trim().max(200).default(""),
});
export type SaveVoiceAssetInput = z.infer<typeof saveVoiceAssetSchema>;

/** Fallback-preview only (used when a voice has no Vbee `demoUrl`) — text
 * is always a short, capped excerpt/sample, never the user's full script,
 * and this never persists anything (see previewVoiceSampleAction). */
export const previewVoiceSampleSchema = z.object({
  voiceCode: z.string().trim().min(1, "Cần chọn giọng đọc."),
  text: z
    .string()
    .trim()
    .min(1, "Văn bản mẫu không được để trống.")
    .max(VBEE_PREVIEW_SAMPLE_MAX_CHARS, `Đoạn nghe thử tối đa ${VBEE_PREVIEW_SAMPLE_MAX_CHARS} ký tự.`),
});
export type PreviewVoiceSampleInput = z.infer<typeof previewVoiceSampleSchema>;
