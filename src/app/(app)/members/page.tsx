import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceAdmin } from "@/lib/workspace/guards";
import { getWorkspaceMembers, getCurrentUser } from "@/lib/workspace/queries";
import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { MembersTable } from "@/components/workspace/members-table";

export default async function MembersPage() {
  const workspace = await requireWorkspaceAdmin();
  const [members, user] = await Promise.all([getWorkspaceMembers(workspace.workspaceId), getCurrentUser()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Thành viên</h1>
        <p className="text-sm text-muted-foreground">{workspace.workspaceName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mời thành viên</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteMemberForm workspaceId={workspace.workspaceId} />
          <p className="mt-2 text-xs text-muted-foreground">
            Người được mời cần đã có tài khoản Creative Hub (đăng ký trước) để có thể thêm vào workspace.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách thành viên</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersTable members={members} currentUserId={user?.id ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
