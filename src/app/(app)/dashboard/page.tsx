import Link from "next/link";
import { Image as ImageIcon, LayoutTemplate, Loader2, Library, Palette, Users, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getRecentAssets, getLibraryAssets } from "@/lib/library/queries";
import { getIncompleteJobs } from "@/lib/generation/queries";
import { getBrands } from "@/lib/brand/queries";
import { getWorkspaceMembers, getCurrentUser } from "@/lib/workspace/queries";
import { AssetGrid } from "@/components/library/asset-grid";
import { StatCard } from "@/components/layout/stat-card";
import { EmptyState } from "@/components/layout/empty-state";
import { ImageHeroArt } from "@/components/dashboard/image-hero-art";
import { BannerHeroArt } from "@/components/dashboard/banner-hero-art";
import { DashboardHeroArt } from "@/components/dashboard/dashboard-hero-art";

export default async function DashboardPage() {
  const workspace = await requireActiveWorkspace();
  const [recentAssets, incompleteJobs, brands, members, libraryTotal, user] = await Promise.all([
    getRecentAssets(workspace.workspaceId),
    getIncompleteJobs(),
    getBrands(workspace.workspaceId),
    getWorkspaceMembers(workspace.workspaceId),
    getLibraryAssets(workspace.workspaceId, {}),
    getCurrentUser(),
  ]);

  const firstName = (user?.name || "bạn").split(" ").pop();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Chào {firstName} 👋</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{workspace.workspaceName}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] items-stretch">
        <div className="relative flex items-center overflow-hidden rounded-xl ring-1 ring-border bg-gradient-to-br from-[#0033C9]/16 via-card to-[#00CF6A]/10 min-h-56 lg:min-h-0">
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

        <div className="flex flex-col gap-4">
          <Link
            href="/create/image"
            className="@container group relative flex flex-1 flex-col @sm:flex-row overflow-hidden rounded-xl bg-gradient-to-br from-[#0033C9]/20 via-[#0033C9]/8 to-transparent ring-1 ring-[#0033C9]/25 hover:ring-[#0033C9]/45 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b85ff] focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
          >
            <div className="relative z-10 flex flex-col gap-3 p-5 @sm:py-5 @sm:pr-2 @sm:max-w-[58%]">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#0033C9] text-white shadow-sm shadow-[#0033C9]/30">
                <ImageIcon className="size-4.5" />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold">Tạo ảnh</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Sinh ảnh bằng AI theo đúng thương hiệu đã chọn.</p>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-[#5b85ff] mt-auto">
                Bắt đầu
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <div className="relative z-0 h-24 @sm:h-auto @sm:w-36 shrink-0 @sm:self-stretch overflow-hidden @sm:[mask-image:linear-gradient(to_right,transparent,black_18%)]">
              <ImageHeroArt className="absolute inset-0 size-full scale-105 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </Link>

          <Link
            href="/create/banner"
            className="@container group relative flex flex-1 flex-col @sm:flex-row overflow-hidden rounded-xl bg-gradient-to-br from-[#00CF6A]/20 via-[#00CF6A]/8 to-transparent ring-1 ring-[#00CF6A]/25 hover:ring-[#00CF6A]/45 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00CF6A] focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
          >
            <div className="relative z-10 flex flex-col gap-3 p-5 @sm:py-5 @sm:pr-2 @sm:max-w-[58%]">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#00CF6A] text-white shadow-sm shadow-[#00CF6A]/30">
                <LayoutTemplate className="size-4.5" />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold">Tạo banner</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Dàn trang banner theo kích thước và guideline.</p>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-[#00CF6A] mt-auto">
                Bắt đầu
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <div className="relative z-0 h-24 @sm:h-auto @sm:w-36 shrink-0 @sm:self-stretch overflow-hidden @sm:[mask-image:linear-gradient(to_right,transparent,black_18%)]">
              <BannerHeroArt className="absolute inset-0 size-full scale-105 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Tài sản" value={libraryTotal.total} icon={Library} />
        <StatCard label="Thương hiệu" value={brands.filter((b) => b.status === "active").length} icon={Palette} />
        <StatCard label="Thành viên" value={members.filter((m) => m.status === "active").length} icon={Users} />
      </div>

      {incompleteJobs.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold mb-1">Tác vụ chưa hoàn tất</h2>
            <div className="flex flex-col divide-y divide-border">
              {incompleteJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/create/image?job=${job.id}`}
                  className="flex items-center gap-2 py-2 text-sm hover:text-foreground"
                >
                  <Loader2 className="size-3.5 animate-spin text-[#5b85ff] shrink-0" />
                  <span className="flex-1 truncate text-muted-foreground">{job.prompt}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Tài sản gần đây</h2>
          {recentAssets.length > 0 && (
            <Link href="/library" className="text-sm font-medium text-[#5b85ff] hover:underline">
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
                  className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Tạo ảnh
                </Link>
                <Link
                  href="/create/banner"
                  className="text-sm font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
