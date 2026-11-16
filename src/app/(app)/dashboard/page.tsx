import Link from "next/link";
import { Image as ImageIcon, LayoutTemplate, Library, Palette, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getRecentAssets, getLibraryAssets } from "@/lib/library/queries";
import { getBrands } from "@/lib/brand/queries";
import { getWorkspaceMembers, getCurrentUser } from "@/lib/workspace/queries";
import { getActiveDashboardBanners, getDashboardFeatureCards } from "@/lib/dashboard/queries";
import { AssetGrid } from "@/components/library/asset-grid";
import { StatCard } from "@/components/layout/stat-card";
import { EmptyState } from "@/components/layout/empty-state";
import { ImageHeroArt } from "@/components/dashboard/image-hero-art";
import { BannerHeroArt } from "@/components/dashboard/banner-hero-art";
import { DashboardHeroArt } from "@/components/dashboard/dashboard-hero-art";
import { BannerCarousel } from "@/components/dashboard/banner-carousel";
import { DashboardFeatureCardTile } from "@/components/dashboard/feature-card-tile";
import type { DashboardFeatureCardSlot } from "@/types/dashboard";

const FEATURE_CARD_META: Record<
  DashboardFeatureCardSlot,
  { icon: LucideIcon; defaultArt: React.ComponentType<{ className?: string }> }
> = {
  image: { icon: ImageIcon, defaultArt: ImageHeroArt },
  banner: { icon: LayoutTemplate, defaultArt: BannerHeroArt },
};

export default async function DashboardPage() {
  const workspace = await requireActiveWorkspace();

  const [recentAssets, brands, members, libraryTotal, user, dashboardBanners, featureCards] = await Promise.all([
    getRecentAssets(workspace.workspaceId),
    getBrands(workspace.workspaceId),
    getWorkspaceMembers(workspace.workspaceId),
    getLibraryAssets(workspace.workspaceId, {}),
    getCurrentUser(),
    getActiveDashboardBanners(workspace.workspaceId),
    getDashboardFeatureCards(workspace.workspaceId),
  ]);

  const firstName = (user?.name || "bạn").split(" ").pop();
  const visibleFeatureCards = featureCards.filter((c) => c.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Chào {firstName} 👋</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{workspace.workspaceName}</h1>
      </div>

      <div className={`grid gap-4 items-stretch ${visibleFeatureCards.length > 0 ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}>
        {dashboardBanners.length > 0 ? (
          <BannerCarousel banners={dashboardBanners} />
        ) : (
          <div className="relative flex h-full items-center overflow-hidden rounded-feature ring-1 ring-border bg-gradient-to-br from-primary/14 via-card to-primary/6 min-h-72 lg:min-h-0">
            <div className="relative z-10 flex flex-col gap-3 p-6 sm:p-8 max-w-[85%] sm:max-w-[60%]">
              <span className="inline-flex w-fit items-center rounded-md bg-gradient-to-r from-primary to-accent px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                Creative Hub
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                Tạo nội dung marketing bằng AI, đúng thương hiệu
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Tạo, quản lý và tải xuống hình ảnh marketing đúng nhận diện thương hiệu — cho{" "}
                {workspace.workspaceName}.
              </p>
            </div>
            <div className="absolute inset-y-0 right-0 z-0 w-[55%] sm:w-[45%] [mask-image:linear-gradient(to_right,transparent,black_30%)]">
              <DashboardHeroArt className="absolute inset-0 size-full" />
            </div>
          </div>
        )}

        {visibleFeatureCards.length > 0 && (
          <div className="flex flex-col gap-4">
            {visibleFeatureCards.map((card) => {
              const { icon: Icon, defaultArt: DefaultArt } = FEATURE_CARD_META[card.slot];
              return (
                <DashboardFeatureCardTile
                  key={card.slot}
                  card={card}
                  icon={<Icon className="size-4.5" />}
                  defaultArt={
                    <DefaultArt className="absolute inset-0 size-full scale-105 transition-transform duration-300 group-hover:scale-110" />
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Tài sản" value={libraryTotal.total} icon={Library} />
        <StatCard label="Thương hiệu" value={brands.filter((b) => b.status === "active").length} icon={Palette} />
        <StatCard label="Thành viên" value={members.filter((m) => m.status === "active").length} icon={Users} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Tài sản gần đây</h2>
          {recentAssets.length > 0 && (
            <Link href="/library" className="text-sm font-medium text-primary hover:underline">
              Xem tất cả →
            </Link>
          )}
        </div>

        {recentAssets.length === 0 ? (
          <EmptyState
            icon={Library}
            title="Chưa có tài sản nào"
            description="Bắt đầu bằng cách tạo ảnh hoặc banner đầu tiên cho thương hiệu của bạn."
            action={
              <>
                <Link
                  href="/create/image"
                  className="text-sm font-bold px-12 py-3 rounded-full bg-gradient-to-r from-primary to-cta-to text-primary-foreground shadow-sm transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Tạo ảnh
                </Link>
                <Link
                  href="/create/banner"
                  className="text-sm font-bold px-12 py-3 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  Tạo banner
                </Link>
              </>
            }
          />
        ) : (
          <AssetGrid assets={recentAssets} currentUserId={user?.id ?? ""} isAdmin={workspace.role === "admin"} />
        )}
      </div>
    </div>
  );
}
