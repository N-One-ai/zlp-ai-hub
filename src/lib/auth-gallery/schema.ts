import { z } from "zod";

export const addAuthGalleryImageFromUploadSchema = z.object({
  imagePath: z.string().trim().min(1, "Thiếu ảnh."),
  imageWidth: z.number().int().positive().nullable(),
  imageHeight: z.number().int().positive().nullable(),
});
export type AddAuthGalleryImageFromUploadInput = z.infer<typeof addAuthGalleryImageFromUploadSchema>;

export const addAuthGalleryImageFromAssetSchema = z.object({
  assetId: z.string().uuid(),
});
export type AddAuthGalleryImageFromAssetInput = z.infer<typeof addAuthGalleryImageFromAssetSchema>;

export const reorderAuthGalleryImagesSchema = z.array(z.string().uuid()).min(1);
