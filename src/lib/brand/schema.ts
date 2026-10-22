import { z } from "zod";

export const brandInputSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên thương hiệu").max(100),
  description: z.string().trim().max(500).default(""),
});
export type BrandInput = z.infer<typeof brandInputSchema>;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Mã màu phải dạng #RRGGBB");

export const brandColorSchema = z.object({
  name: z.string().trim().min(1).max(40),
  hex: hexColorSchema,
  role: z.enum(["primary", "secondary", "background", "text", "accent"]),
});

const fontChoiceSchema = z.object({
  family: z.string().trim().min(1).max(80),
  fallback: z.string().trim().min(1).max(80),
});

export const brandFontsSchema = z.object({
  heading: fontChoiceSchema.optional(),
  body: fontChoiceSchema.optional(),
});

export const safeZoneSchema = z.object({
  topPx: z.number().int().min(0).max(2000).optional(),
  rightPx: z.number().int().min(0).max(2000).optional(),
  bottomPx: z.number().int().min(0).max(2000).optional(),
  leftPx: z.number().int().min(0).max(2000).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const logoRulesSchema = z.object({
  preferredVariant: z.enum(["primary", "secondary", "light", "dark"]).optional(),
  minSizePx: z.number().int().min(0).max(2000).optional(),
  clearSpacePx: z.number().int().min(0).max(500).optional(),
  acceptableBackgrounds: z.enum(["light", "dark", "either"]).optional(),
});

export const guidelineInputSchema = z.object({
  colors: z.array(brandColorSchema).max(20).default([]),
  fonts: brandFontsSchema.default({}),
  safeZone: safeZoneSchema.default({}),
  logoRules: logoRulesSchema.default({}),
  layoutNotes: z.string().trim().max(1000).default(""),
});
export type GuidelineInput = z.infer<typeof guidelineInputSchema>;

export const sizePresetInputSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên preset").max(100),
  channel: z.string().trim().max(100).default(""),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
  exportFormat: z.enum(["png", "jpg"]).default("png"),
});
export type SizePresetInput = z.infer<typeof sizePresetInputSchema>;

export const templateInputSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên mẫu").max(100),
  sizePresetId: z.string().uuid().nullable(),
  layout: z
    .object({
      logo: z.object({ x: z.number().int(), y: z.number().int(), widthPx: z.number().int().min(1) }).optional(),
      textFields: z
        .array(
          z.object({
            id: z.string().trim().min(1),
            label: z.string().trim().min(1),
            x: z.number().int(),
            y: z.number().int(),
            maxWidthPx: z.number().int().min(1),
          })
        )
        .default([]),
    })
    .default({ textFields: [] }),
});
export type TemplateInput = z.infer<typeof templateInputSchema>;
