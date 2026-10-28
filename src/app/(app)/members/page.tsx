import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getWorkspaceMembers, getCurrentUser } from "@/lib/workspace/queries";
import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { MembersTable } from "@/components/workspace/members-table";

export default async function MembersPage() {
  const workspace = await requireWorkspaceAdmin();
  const [members, user] = await Promise.all([getWorkspaceMembers(workspace.workspaceId), getCurrentUser()]);
  const activeCount = members.filter((m) => m.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Thành viên</h1>
        <p className="text-sm text-muted-foreground">
          {workspace.workspaceName} · {activeCount} thành viên đang hoạt động
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
          <CardAction className="text-xs text-muted-foreground">{members.length} thành viên</CardAction>
        </CardHeader>
        <CardContent>
          <MembersTable members={members} currentUserId={user?.id ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
