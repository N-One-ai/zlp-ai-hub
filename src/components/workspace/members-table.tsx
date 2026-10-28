"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreVertical, Search, ShieldOff, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateMemberRole, revokeMember } from "@/lib/workspace/actions";
import type { MemberWithProfile } from "@/types/workspace";
import type { MembershipRole, MembershipStatus } from "@/types/database";

const STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "Đang hoạt động",
  invited: "Đã mời",
  revoked: "Đã thu hồi",
};

const STATUS_BADGE_CLASS: Record<MembershipStatus, string> = {
  active: "border-emerald-600/30 text-emerald-700 dark:text-emerald-400",
  invited: "border-amber-600/40 text-amber-700 dark:text-amber-400",
  revoked: "border-border text-muted-foreground",
};

const ROLE_LABEL: Record<MembershipRole, string> = { admin: "Admin", creator: "Creator", viewer: "Viewer" };
const ROLE_ORDER: MembershipRole[] = ["admin", "creator", "viewer"];

function roleBadgeVariant(role: MembershipRole) {
  if (role === "admin") return "default" as const;
  if (role === "creator") return "secondary" as const;
  return "outline" as const;
}

const ALL = "__all__";
/** Below this count, search + filters add clutter without helping — the
 * whole list is already visible at a glance. */
const FILTER_THRESHOLD = 8;

function initialOf(name: string | null, email: string) {
  return (name || email).charAt(0).toUpperCase();
}

function MemberActions({
  member,
  isPending,
  onRoleChange,
  onRequestRevoke,
}: {
  member: MemberWithProfile;
  isPending: boolean;
  onRoleChange: (membershipId: string, role: MembershipRole) => void;
  onRequestRevoke: (member: MemberWithProfile) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={`Thao tác với ${member.name || member.email}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>Đổi vai trò</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={member.role}
          onValueChange={(v) => onRoleChange(member.membershipId, v as MembershipRole)}
        >
          {ROLE_ORDER.map((role) => (
            <DropdownMenuRadioItem key={role} value={role}>
              {ROLE_LABEL[role]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onRequestRevoke(member)}>
          <ShieldOff className="size-4" />
          Thu hồi quyền truy cập
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MembersTable({ members, currentUserId }: { members: MemberWithProfile[]; currentUserId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [revokeTarget, setRevokeTarget] = useState<MemberWithProfile | null>(null);

  const showToolbar = members.length > FILTER_THRESHOLD;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== ALL && m.role !== roleFilter) return false;
      if (statusFilter !== ALL && m.status !== statusFilter) return false;
      if (q && !(m.name || "").toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, search, roleFilter, statusFilter]);

  function handleRoleChange(membershipId: string, role: MembershipRole) {
    const target = members.find((m) => m.membershipId === membershipId);
    startTransition(async () => {
      const result = await updateMemberRole(membershipId, role);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Đã đổi vai trò của ${target?.name || target?.email || "thành viên"} thành ${ROLE_LABEL[role]}.`);
      router.refresh();
    });
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    startTransition(async () => {
      const result = await revokeMember(target.membershipId);
      if (!result.ok) {
        toast.error(result.error.message);
        setRevokeTarget(null);
        return;
      }
      toast.success(`Đã thu hồi quyền truy cập của ${target.name || target.email}.`);
      setRevokeTarget(null);
      router.refresh();
    });
  }

  const hasActiveFilters = search.trim() !== "" || roleFilter !== ALL || statusFilter !== ALL;

  function clearFilters() {
    setSearch("");
    setRoleFilter(ALL);
    setStatusFilter(ALL);
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Users2 className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Chưa có thành viên nào trong workspace.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {showToolbar && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="pl-9"
              aria-label="Tìm thành viên"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? ALL)}>
            <SelectTrigger className="w-full sm:w-32" aria-label="Lọc theo vai trò">
              <SelectValue placeholder="Vai trò" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi vai trò</SelectItem>
              {ROLE_ORDER.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABEL[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Lọc theo trạng thái">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
              {(Object.keys(STATUS_LABEL) as MembershipStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Search className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Không tìm thấy thành viên phù hợp.</p>
          {hasActiveFilters && (
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Xoá bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Thành viên</th>
                  <th className="pb-2 font-medium">Vai trò</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">Tham gia</th>
                  <th className="pb-2 font-medium sr-only">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((m) => {
                  const isSelf = m.userId === currentUserId;
                  const isRevoked = m.status === "revoked";
                  return (
                    <tr key={m.membershipId} className={isRevoked ? "opacity-60" : undefined}>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="size-8 shrink-0">
                            {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name ?? ""} />}
                            <AvatarFallback className="text-xs">{initialOf(m.name, m.email)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-medium truncate">
                              <span className="truncate">{m.name || "—"}</span>
                              {isSelf && (
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  Bạn
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={roleBadgeVariant(m.role)}>{ROLE_LABEL[m.role]}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[m.status]}>
                          {STATUS_LABEL[m.status]}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3 text-right">
                        {!isSelf && !isRevoked && (
                          <MemberActions
                            member={m}
                            isPending={isPending}
                            onRoleChange={handleRoleChange}
                            onRequestRevoke={setRevokeTarget}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map((m) => {
              const isSelf = m.userId === currentUserId;
              const isRevoked = m.status === "revoked";
              return (
                <div
                  key={m.membershipId}
                  className={`flex flex-col gap-3 rounded-lg ring-1 ring-border p-3 ${isRevoked ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9 shrink-0">
                      {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name ?? ""} />}
                      <AvatarFallback className="text-xs">{initialOf(m.name, m.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium truncate">
                        <span className="truncate">{m.name || "—"}</span>
                        {isSelf && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            Bạn
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    {!isSelf && !isRevoked && (
                      <MemberActions
                        member={m}
                        isPending={isPending}
                        onRoleChange={handleRoleChange}
                        onRequestRevoke={setRevokeTarget}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={roleBadgeVariant(m.role)}>{ROLE_LABEL[m.role]}</Badge>
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[m.status]}>
                        {STATUS_LABEL[m.status]}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi quyền truy cập?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.name || revokeTarget?.email} sẽ mất quyền truy cập vào workspace này ngay lập tức. Bạn có
              thể mời lại sau nếu cần.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Thu hồi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
