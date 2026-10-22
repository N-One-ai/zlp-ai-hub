"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateMemberRole, revokeMember } from "@/lib/workspace/actions";
import type { MemberWithProfile } from "@/types/workspace";
import type { MembershipRole } from "@/types/database";

const STATUS_LABEL: Record<MemberWithProfile["status"], string> = {
  active: "Đang hoạt động",
  invited: "Đã mời",
  revoked: "Đã thu hồi",
};

export function MembersTable({ members, currentUserId }: { members: MemberWithProfile[]; currentUserId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(membershipId: string, role: MembershipRole) {
    startTransition(async () => {
      const result = await updateMemberRole(membershipId, role);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleRevoke(membershipId: string) {
    startTransition(async () => {
      const result = await revokeMember(membershipId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã thu hồi quyền truy cập.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col divide-y">
      {members.map((m) => {
        const isSelf = m.userId === currentUserId;
        const isRevoked = m.status === "revoked";
        return (
          <div key={m.membershipId} className="flex items-center gap-3 py-3">
            <Avatar className="size-8 shrink-0">
              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name ?? ""} />}
              <AvatarFallback className="text-xs">{(m.name || m.email).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {m.name || "—"} {isSelf && <span className="text-muted-foreground font-normal">(bạn)</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>
            <Badge variant={isRevoked ? "outline" : "secondary"} className="shrink-0">
              {STATUS_LABEL[m.status]}
            </Badge>
            <Select
              value={m.role}
              disabled={isPending || isSelf || isRevoked}
              onValueChange={(v) => handleRoleChange(m.membershipId, v as MembershipRole)}
            >
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            {!isSelf && !isRevoked && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => handleRevoke(m.membershipId)}
                className="shrink-0 text-destructive hover:text-destructive"
              >
                Thu hồi
              </Button>
            )}
          </div>
        );
      })}
      {members.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Chưa có thành viên.</p>}
    </div>
  );
}
