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

// Upper bound raised from 90 to 150 so "Chậm" can be a genuinely slow
// 120s/loop (half the speed of the original 60s value) — see
// migration 0015_dashboard_marquee_style.sql, which widens the matching
// DB check constraint the same way.
export const dashboardMarqueeSpeedSchema = z.number().int().min(15).max(150);

export const dashboardMarqueeFontSizeSchema = z.enum(["sm", "md", "lg"]);
export type DashboardMarqueeFontSize = z.infer<typeof dashboardMarqueeFontSizeSchema>;

export const dashboardMarqueeTextStyleSchema = z.enum(["solid", "stroke"]);
export type DashboardMarqueeTextStyle = z.infer<typeof dashboardMarqueeTextStyleSchema>;

export const dashboardMarqueeInputSchema = z.object({
  text: z.string().trim().min(1, "Vui lòng nhập nội dung dải chữ").max(200),
  speedSeconds: dashboardMarqueeSpeedSchema.default(40),
  fontSize: dashboardMarqueeFontSizeSchema.default("sm"),
  textStyle: dashboardMarqueeTextStyleSchema.default("solid"),
  isActive: z.boolean().default(true),
});
export type DashboardMarqueeInput = z.infer<typeof dashboardMarqueeInputSchema>;
