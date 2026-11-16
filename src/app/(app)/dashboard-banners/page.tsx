import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getDashboardBanners, getDashboardFeatureCards } from "@/lib/dashboard/queries";
import { DashboardBannersManager } from "@/components/dashboard/dashboard-banners-manager";
import { FeatureCardsManager } from "@/components/dashboard/feature-cards-manager";
import { Separator } from "@/components/ui/separator";

export default async function DashboardBannersPage() {
  const workspace = await requireWorkspaceAdmin();
  const [banners, featureCards] = await Promise.all([
    getDashboardBanners(workspace.workspaceId),
    getDashboardFeatureCards(workspace.workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <DashboardBannersManager workspaceId={workspace.workspaceId} banners={banners} />
      <Separator />
      <FeatureCardsManager workspaceId={workspace.workspaceId} cards={featureCards} />
    </div>
  );
}
