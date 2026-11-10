import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getCurrentUser, searchWorkspaceMembers, searchUnassignedUsers } from "@/lib/workspace/queries";
import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { MembersTable } from "@/components/workspace/members-table";
import { UnassignedUsersTable } from "@/components/workspace/unassigned-users-table";

export default async function MembersPage() {
  const workspace = await requireWorkspaceAdmin();
  const [membersResult, unassignedResult, user] = await Promise.all([
    searchWorkspaceMembers(workspace.workspaceId),
    searchUnassignedUsers(workspace.workspaceId),
    getCurrentUser(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Thành viên</h1>
        <p className="text-sm text-muted-foreground">
          {workspace.workspaceName} · {membersResult.total} thành viên
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mời thành viên</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteMemberForm workspaceId={workspace.workspaceId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách thành viên</CardTitle>
          <CardAction className="text-xs text-muted-foreground">{membersResult.total} thành viên</CardAction>
        </CardHeader>
        <CardContent>
          <MembersTable
            workspaceId={workspace.workspaceId}
            currentUserId={user?.id ?? ""}
            initialResult={membersResult}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mới đăng ký, chưa thuộc workspace</CardTitle>
          <CardAction className="text-xs text-muted-foreground">
            {unassignedResult.backendPaginated ? `${unassignedResult.total} người dùng` : null}
          </CardAction>
        </CardHeader>
        <CardContent>
          <UnassignedUsersTable
            workspaceId={workspace.workspaceId}
            initialResult={unassignedResult}
            canCheck={unassignedResult.backendPaginated}
          />
        </CardContent>
      </Card>
    </div>
  );
}
