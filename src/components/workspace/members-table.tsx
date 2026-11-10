"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, MoreVertical, Search, ShieldOff, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PaginationControls } from "@/components/workspace/pagination-controls";
import { updateMemberRole, revokeMember, searchWorkspaceMembersAction } from "@/lib/workspace/actions";
import type { MemberWithProfile, PaginatedResult } from "@/types/workspace";
import type { MembershipRole, MembershipStatus } from "@/types/database";

const STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "Đang hoạt động",
  invited: "Đã mời",
  revoked: "Đã thu hồi",
};

const STATUS_BADGE_CLASS: Record<MembershipStatus, string> = {
  active: "border-success/30 text-success",
  invited: "border-warning/40 text-warning",
  revoked: "border-border text-muted-foreground",
};

const ROLE_LABEL: Record<MembershipRole, string> = { admin: "Admin", creator: "Creator", viewer: "Viewer" };
const ROLE_ORDER: MembershipRole[] = ["admin", "creator", "viewer"];

/** Debounce delay for re-querying the backend as the user types. */
const SEARCH_DEBOUNCE_MS = 300;

function roleBadgeVariant(role: MembershipRole) {
  if (role === "admin") return "default" as const;
  if (role === "creator") return "secondary" as const;
  return "outline" as const;
}

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
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
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

export function MembersTable({
  workspaceId,
  currentUserId,
  initialResult,
}: {
  workspaceId: string;
  currentUserId: string;
  initialResult: PaginatedResult<MemberWithProfile>;
}) {
  const router = useRouter();
  const [isActionPending, startActionTransition] = useTransition();
  const [isSearching, setIsSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(initialResult);
  // The search term that actually produced `result` — kept separate from
  // the live `search` input so empty/no-results messaging reflects what's
  // on screen, not what's mid-keystroke/mid-debounce. Using the live input
  // for this caused a flash of the wrong empty state (e.g. "no members at
  // all") for the ~300ms between clearing the box and the debounced
  // re-fetch landing.
  const [committedSearch, setCommittedSearch] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<MemberWithProfile | null>(null);
  const requestId = useRef(0);

  async function load(nextSearch: string, nextPage: number) {
    const id = ++requestId.current;
    setIsSearching(true);
    const res = await searchWorkspaceMembersAction(workspaceId, { search: nextSearch, page: nextPage });
    if (id !== requestId.current) return; // superseded by a newer request
    setIsSearching(false);
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    // Page became empty after a mutation/search narrowed the result set —
    // clamp back to the last valid page instead of showing a stuck blank page.
    if (res.data.items.length === 0 && res.data.total > 0 && nextPage > 1) {
      const lastPage = Math.max(1, Math.ceil(res.data.total / res.data.pageSize));
      setPage(lastPage);
      await load(nextSearch, lastPage);
      return;
    }
    setResult(res.data);
    setCommittedSearch(nextSearch);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      void load(search, 1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    void load(search, nextPage);
  }

  function refetch() {
    void load(search, page);
  }

  function handleRoleChange(membershipId: string, role: MembershipRole) {
    const target = result.items.find((m) => m.membershipId === membershipId);
    startActionTransition(async () => {
      const res = await updateMemberRole(membershipId, role);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Đã đổi vai trò của ${target?.name || target?.email || "thành viên"} thành ${ROLE_LABEL[role]}.`);
      refetch();
      router.refresh();
    });
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    startActionTransition(async () => {
      const res = await revokeMember(target.membershipId);
      if (!res.ok) {
        toast.error(res.error.message);
        setRevokeTarget(null);
        return;
      }
      toast.success(`Đã thu hồi quyền truy cập của ${target.name || target.email}.`);
      setRevokeTarget(null);
      refetch();
      router.refresh();
    });
  }

  const isBusy = isActionPending || isSearching;
  const hasSearch = committedSearch.trim() !== "";
  const showToolbar = result.total > 0 || hasSearch;

  return (
    <div className="flex flex-col gap-4">
      {showToolbar && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="pl-9"
            aria-label="Tìm thành viên"
          />
        </div>
      )}

      {loadError ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <AlertTriangle className="size-8 text-destructive/60" />
          <p className="text-sm text-muted-foreground">Không tải được danh sách thành viên.</p>
          <Button size="sm" variant="outline" onClick={refetch}>
            Thử lại
          </Button>
        </div>
      ) : result.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          {hasSearch ? (
            <>
              <Search className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Không tìm thấy thành viên phù hợp.</p>
            </>
          ) : (
            <>
              <Users2 className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Chưa có thành viên nào trong workspace.</p>
            </>
          )}
        </div>
      ) : (
        <div className={isBusy ? "opacity-60 transition-opacity" : "transition-opacity"}>
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
                {result.items.map((m) => {
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
                            isPending={isActionPending}
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
            {result.items.map((m) => {
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
                        isPending={isActionPending}
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
        </div>
      )}

      {!loadError && (
        <PaginationControls
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          onPageChange={handlePageChange}
          disabled={isBusy}
        />
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
            <AlertDialogCancel disabled={isActionPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              disabled={isActionPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isActionPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Thu hồi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
