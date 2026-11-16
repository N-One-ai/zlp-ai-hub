import type { DashboardFeatureCardBackground, DashboardFeatureCardSlot } from "@/types/dashboard";

/** The built-in content for each fixed card slot — exactly what
 * dashboard/page.tsx hard-coded before this became customizable. A
 * workspace with no dashboard_feature_cards row for a slot (every
 * workspace that existed before migration 0013, and any slot an admin
 * has never touched or has reset) renders this verbatim, so the
 * Dashboard looks identical to today until an admin opts in. */
export const DASHBOARD_FEATURE_CARD_DEFAULTS: Record<
  DashboardFeatureCardSlot,
  { title: string; description: string; ctaLabel: string; ctaUrl: string; backgroundStyle: DashboardFeatureCardBackground }
> = {
  image: {
    title: "Tạo ảnh",
    description: "Sinh ảnh bằng AI theo đúng thương hiệu đã chọn.",
    ctaLabel: "Bắt đầu",
    ctaUrl: "/create/image",
    backgroundStyle: "primary",
  },
  banner: {
    title: "Tạo banner",
    description: "Dàn trang banner theo kích thước và guideline.",
    ctaLabel: "Bắt đầu",
    ctaUrl: "/create/banner",
    backgroundStyle: "primary",
  },
};
