import { z } from "zod";

export function isValidCtaUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true; // internal route
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const focalSchema = z.number().int().min(0).max(100).default(50);

export const dashboardBannerInputSchema = z
  .object({
    title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(200),
    description: z.string().trim().max(500).default(""),
    ctaLabel: z.string().trim().max(50).default(""),
    ctaUrl: z
      .string()
      .trim()
      .max(500)
      .default("")
      .refine(
        (value) => value === "" || isValidCtaUrl(value),
        "Đường dẫn CTA không hợp lệ. Dùng URL đầy đủ (https://...) hoặc đường dẫn nội bộ bắt đầu bằng /."
      ),
    imagePath: z.string().trim().min(1, "Vui lòng tải lên hình ảnh"),
    imageWidth: z.number().int().positive().nullable().default(null),
    imageHeight: z.number().int().positive().nullable().default(null),
    focalX: focalSchema,
    focalY: focalSchema,
    mobileImagePath: z.string().trim().nullable().default(null),
    mobileImageWidth: z.number().int().positive().nullable().default(null),
    mobileImageHeight: z.number().int().positive().nullable().default(null),
    mobileFocalX: focalSchema,
    mobileFocalY: focalSchema,
    isActive: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.ctaLabel) === Boolean(value.ctaUrl), {
    message: "Vui lòng điền cả nhãn CTA và đường dẫn CTA, hoặc để trống cả hai.",
    path: ["ctaUrl"],
  });
export type DashboardBannerInput = z.infer<typeof dashboardBannerInputSchema>;

export const reorderDashboardBannersSchema = z.array(z.string().uuid()).min(1);

export const dashboardFeatureCardSlotSchema = z.enum(["image", "banner"]);
export type DashboardFeatureCardSlot = z.infer<typeof dashboardFeatureCardSlotSchema>;

export const dashboardFeatureCardBackgroundStyleSchema = z.enum(["primary", "accent", "neutral"]);
export type DashboardFeatureCardBackgroundStyle = z.infer<typeof dashboardFeatureCardBackgroundStyleSchema>;

// Image is OPTIONAL here (unlike the big banner's) — "Nếu không có ảnh
// tuỳ chỉnh, dùng icon/minh hoạ mặc định hiện tại" (ImageHeroArt/
// BannerHeroArt), so a card can be customized (title/CTA/background)
// without ever uploading a replacement image.
export const dashboardFeatureCardInputSchema = z
  .object({
    slot: dashboardFeatureCardSlotSchema,
    title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(100),
    description: z.string().trim().max(300).default(""),
    ctaLabel: z.string().trim().max(50).default(""),
    ctaUrl: z
      .string()
      .trim()
      .max(500)
      .default("")
      .refine(
        (value) => value === "" || isValidCtaUrl(value),
        "Đường dẫn CTA không hợp lệ. Dùng URL đầy đủ (https://...) hoặc đường dẫn nội bộ bắt đầu bằng /."
      ),
    imagePath: z.string().trim().nullable().default(null),
    imageWidth: z.number().int().positive().nullable().default(null),
    imageHeight: z.number().int().positive().nullable().default(null),
    focalX: focalSchema,
    focalY: focalSchema,
    backgroundStyle: dashboardFeatureCardBackgroundStyleSchema.default("primary"),
    isActive: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.ctaLabel) === Boolean(value.ctaUrl), {
    message: "Vui lòng điền cả nhãn CTA và đường dẫn CTA, hoặc để trống cả hai.",
    path: ["ctaUrl"],
  });
export type DashboardFeatureCardInput = z.infer<typeof dashboardFeatureCardInputSchema>;
