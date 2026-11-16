import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getDashboardBanners } from "@/lib/dashboard/queries";
import { DashboardBannersManager } from "@/components/dashboard/dashboard-banners-manager";

export default async function DashboardBannersPage() {
  const workspace = await requireWorkspaceAdmin();
  const banners = await getDashboardBanners(workspace.workspaceId);

  return <DashboardBannersManager workspaceId={workspace.workspaceId} banners={banners} />;
}
