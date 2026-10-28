import { z } from "zod";

// The schema's own ceiling is the HIGHEST confirmed limit across all
// models (32000, OpenAI's gpt-image) so it never blocks a model that
// legitimately supports more than the app's conservative default — the
// per-model limit (often lower, see model-meta.ts/providers/*.ts) is
// enforced separately in generateImages() once the actual model/fallback
// chain is known, with its own friendly message naming that limit.
// `sizePresetId` (a workspace size_presets row) and `exactSize` (a
// model-native size, e.g. one of Higgsfield's 16 confirmed
// width_and_height values — see providers/higgsfield-sizes.ts) are
// mutually exclusive size sources: exactly one must be present. The
// HiggsfieldSizePicker sends exactSize when the user has explicitly
// selected a Higgsfield model, so the request carries the exact value
// that model's API accepts — never a workspace preset silently
// re-mapped. Every other model keeps using sizePresetId as before.
// Marketing Studio's own size source — an aspect_ratio + resolution tier,
// not a pixel width/height (see providers/marketing-studio-provider.ts) —
// so it's a THIRD, equally mutually-exclusive size source alongside
// sizePresetId/exactSize, never silently derived from one of those.
const MARKETING_STUDIO_ASPECT_RATIOS = ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"] as const;
const MARKETING_STUDIO_RESOLUTIONS = ["1k", "2k", "4k"] as const;

export const generateImageInputSchema = z
  .object({
    brandId: z.string().uuid(),
    prompt: z
      .string()
      .trim()
      .min(3, "Mô tả quá ngắn — cần ít nhất 3 ký tự.")
      .max(32000, "Mô tả quá dài — tối đa 32.000 ký tự."),
    negativePrompt: z.string().trim().max(500, "Phần loại trừ quá dài — tối đa 500 ký tự.").default(""),
    sizePresetId: z.string().uuid().optional(),
    exactSize: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
    aspectRatio: z.enum(MARKETING_STUDIO_ASPECT_RATIOS).optional(),
    resolution: z.enum(MARKETING_STUDIO_RESOLUTIONS).optional(),
    enhancePrompt: z.boolean().default(false),
    presetId: z.string().uuid().optional(),
    count: z.number().int().min(1).max(4).default(1),
    model: z.string().trim().min(1).default("auto"),
    // A signed URL to a reference image already uploaded to our own
    // Storage (see uploadReferenceImage in actions.ts) — never an
    // arbitrary client-supplied URL, so the server never fetches
    // attacker-controlled addresses on the user's behalf (SSRF).
    referenceImageUrl: z.string().url().optional(),
    // Same SSRF constraint as referenceImageUrl above, for models that
    // accept more than one reference image (Marketing Studio).
    referenceImageUrls: z.array(z.string().url()).max(2, "Tối đa 2 ảnh tham chiếu.").optional(),
  })
  .refine(
    (data) => [Boolean(data.sizePresetId), Boolean(data.exactSize), Boolean(data.aspectRatio)].filter(Boolean).length === 1,
    { message: "Cần chọn đúng một kích thước.", path: ["sizePresetId"] }
  )
  .refine((data) => !data.aspectRatio || Boolean(data.resolution), {
    message: "Cần chọn resolution.",
    path: ["resolution"],
  })
  .refine((data) => !data.enhancePrompt || Boolean(data.presetId), {
    message: "Chế độ Enhance cần chọn một preset.",
    path: ["presetId"],
  })
  .refine((data) => !data.enhancePrompt || (data.referenceImageUrls?.length ?? 0) >= 1, {
    message: "Chế độ Enhance cần ít nhất 1 ảnh sản phẩm tham chiếu.",
    path: ["referenceImageUrls"],
  });
export type GenerateImageInput = z.infer<typeof generateImageInputSchema>;

export const saveResultSchema = z.object({
  jobId: z.string().uuid(),
  outputIndex: z.number().int().min(0),
  name: z.string().trim().max(200).default(""),
  campaign: z.string().trim().max(200).default(""),
});
export type SaveResultInput = z.infer<typeof saveResultSchema>;
