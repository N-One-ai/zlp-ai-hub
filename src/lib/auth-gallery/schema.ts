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

// Same shape as the "add" schemas above plus the row being replaced — used
// by the per-row "chỉnh sửa/upload ảnh ngay tại vị trí" affordance, which
// swaps a row's image in place (keeps its id/sort_order/is_active) instead
// of inserting a new row.
export const replaceAuthGalleryImageFromUploadSchema = z.object({
  id: z.string().uuid(),
  imagePath: z.string().trim().min(1, "Thiếu ảnh."),
  imageWidth: z.number().int().positive().nullable(),
  imageHeight: z.number().int().positive().nullable(),
});
export type ReplaceAuthGalleryImageFromUploadInput = z.infer<typeof replaceAuthGalleryImageFromUploadSchema>;

export const replaceAuthGalleryImageFromAssetSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
});
export type ReplaceAuthGalleryImageFromAssetInput = z.infer<typeof replaceAuthGalleryImageFromAssetSchema>;
