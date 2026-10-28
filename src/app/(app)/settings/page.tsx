import Link from "next/link";
import { Building2, ChevronRight, Palette, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { AvatarEditor } from "@/components/settings/avatar-editor";
import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getCurrentUser, getMyWorkspaces, getWorkspaceMembers } from "@/lib/workspace/queries";
import { getBrands } from "@/lib/brand/queries";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", creator: "Creator", viewer: "Viewer" };

export default async function SettingsPage() {
  const workspace = await requireActiveWorkspace();
  const isAdmin = workspace.role === "admin";

  const [user, workspaces, brands, members] = await Promise.all([
    getCurrentUser(),
    getMyWorkspaces(),
    isAdmin ? getBrands(workspace.workspaceId) : Promise.resolve(null),
    isAdmin ? getWorkspaceMembers(workspace.workspaceId) : Promise.resolve(null),
  ]);

  const name = user?.name || user?.email || "—";
  const activeBrandCount = brands?.filter((b) => b.status === "active").length ?? null;
  const activeMemberCount = members?.filter((m) => m.status === "active").length ?? null;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Cài đặt</h1>
        <p className="text-sm text-muted-foreground">Quản lý tài khoản và workspace của bạn</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AvatarEditor currentAvatarUrl={user?.avatarUrl ?? null} name={name} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{name}</span>
              <Badge variant="outline">{ROLE_LABEL[workspace.role] ?? workspace.role}</Badge>
            </div>
            <span className="text-sm text-muted-foreground truncate">{user?.email}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tên và email được đồng bộ từ phiên đăng nhập hiện tại — chưa hỗ trợ chỉnh sửa trực tiếp ở đây.
          </p>
          <Separator />
          <SignOutButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-muted-foreground" />
            Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium truncate">{workspace.workspaceName}</span>
              <span className="text-xs text-muted-foreground">Vai trò của bạn: {ROLE_LABEL[workspace.role] ?? workspace.role}</span>
            </div>
            {workspaces.length > 1 && <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={workspace.workspaceId} />}
          </div>
          {workspaces.length <= 1 && (
            <p className="text-xs text-muted-foreground">Bạn hiện chỉ thuộc một workspace.</p>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thương hiệu &amp; Thành viên</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href="/brands"
              className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-3 transition-colors hover:bg-accent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Palette className="size-4 text-muted-foreground" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">Thương hiệu</span>
                <span className="block text-xs text-muted-foreground">
                  {activeBrandCount !== null ? `${activeBrandCount} đang hoạt động` : "Quản lý thương hiệu"}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
            <Link
              href="/members"
              className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-3 transition-colors hover:bg-accent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Users className="size-4 text-muted-foreground" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">Thành viên</span>
                <span className="block text-xs text-muted-foreground">
                  {activeMemberCount !== null ? `${activeMemberCount} thành viên` : "Quản lý thành viên"}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
