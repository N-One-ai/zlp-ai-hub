import { z } from "zod";

export const createBannerInputSchema = z.object({
  brandId: z.string().uuid(),
  sizePresetId: z.string().uuid(),
  backgroundAssetId: z.string().uuid().nullable(),
  templateId: z.string().uuid().nullable(),
});
export type CreateBannerInput = z.infer<typeof createBannerInputSchema>;

const layerSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["background", "image", "text", "logo", "shape"]),
  x: z.number(),
  y: z.number(),
  width: z.number().min(0),
  height: z.number().min(0),
  rotation: z.number().default(0),
  zIndex: z.number().default(0),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  role: z.enum(["tagline", "subtitle"]).optional(),
  imagePath: z.string().optional(),
  featherPx: z.number().min(0).max(64).optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
  text: z.string().optional(),
  fontFamily: z.string().optional(),
  fontFallback: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.number().optional(),
  color: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  shapeKind: z.enum(["rect", "ellipse"]).optional(),
  fill: z.string().optional(),
});

export const saveDesignDocumentSchema = z.object({
  assetId: z.string().uuid(),
  layers: z.array(layerSchema).max(100),
  sizePresetId: z.string().uuid(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  /** Every size variant the user has touched this session, keyed by
   * size_presets.id — including the active one (duplicated into both
   * `layers` and here so every reader can keep using the simpler
   * top-level `layers` field). See DesignDocumentContent. */
  sizeVariants: z.record(z.string(), z.array(layerSchema).max(100)).default({}),
});
export type SaveDesignDocumentInput = z.infer<typeof saveDesignDocumentSchema>;

export const exportDesignSchema = z.object({
  assetId: z.string().uuid(),
  designDocumentId: z.string().uuid(),
  format: z.enum(["png", "jpg"]),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});
export type ExportDesignInput = z.infer<typeof exportDesignSchema>;
