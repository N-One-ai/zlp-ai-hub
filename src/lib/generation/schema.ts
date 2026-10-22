import { z } from "zod";

export const generateImageInputSchema = z.object({
  brandId: z.string().uuid(),
  prompt: z.string().trim().min(3, "Mô tả quá ngắn").max(1000),
  negativePrompt: z.string().trim().max(500).default(""),
  sizePresetId: z.string().uuid(),
  count: z.number().int().min(1).max(4).default(1),
});
export type GenerateImageInput = z.infer<typeof generateImageInputSchema>;

export const saveResultSchema = z.object({
  jobId: z.string().uuid(),
  outputIndex: z.number().int().min(0),
  name: z.string().trim().max(200).default(""),
  campaign: z.string().trim().max(200).default(""),
});
export type SaveResultInput = z.infer<typeof saveResultSchema>;
