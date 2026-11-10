"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Search, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationControls } from "@/components/workspace/pagination-controls";
import { inviteMember, searchUnassignedUsersAction } from "@/lib/workspace/actions";
import type { PaginatedResult, UnassignedUser } from "@/types/workspace";
import type { MembershipRole } from "@/types/database";

const ROLE_OPTIONS: { value: MembershipRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "creator", label: "Creator" },
  { value: "admin", label: "Admin" },
];

const SEARCH_DEBOUNCE_MS = 300;

function initialOf(name: string | null, email: string) {
  return (name || email).charAt(0).toUpperCase();
}

/**
 * Users who already signed up for Creative Hub but have no membership row
 * in this workspace yet. Fully dependent on migration 0009's
 * search_unassigned_users RPC — `canCheck: false` means that migration
 * hasn't been applied in this environment yet, so this is disclosed to the
 * admin rather than silently showing an empty "no one new" list.
 */
export function UnassignedUsersTable({
  workspaceId,
  initialResult,
  canCheck,
}: {
  workspaceId: string;
  initialResult: PaginatedResult<UnassignedUser>;
  canCheck: boolean;
}) {
  const router = useRouter();
  const [isAdding, startAddTransition] = useTransition();
  const [isSearching, setIsSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState(initialResult);
  // See the identical field in members-table.tsx: keeps empty/no-results
  // messaging tied to what `result` actually shows, not the live input.
  const [committedSearch, setCommittedSearch] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [roleByUser, setRoleByUser] = useState<Record<string, MembershipRole>>({});
  const requestId = useRef(0);

  async function load(nextSearch: string, nextPage: number) {
    const id = ++requestId.current;
    setIsSearching(true);
    const res = await searchUnassignedUsersAction(workspaceId, { search: nextSearch, page: nextPage });
    if (id !== requestId.current) return;
    setIsSearching(false);
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    if (res.data.items.length === 0 && res.data.total > 0 && nextPage > 1) {
      const lastPage = Math.max(1, Math.ceil(res.data.total / res.data.pageSize));
      await load(nextSearch, lastPage);
      return;
    }
    setResult(res.data);
    setCommittedSearch(nextSearch);
  }

  useEffect(() => {
    if (!canCheck) return;
    const handle = setTimeout(() => {
      void load(search, 1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, canCheck]);

  function refetch() {
    void load(search, result.page);
  }

  function handleAdd(user: UnassignedUser) {
    const role = roleByUser[user.userId] ?? "viewer";
    setAddingUserId(user.userId);
    startAddTransition(async () => {
      const res = await inviteMember(workspaceId, user.email, role);
      setAddingUserId(null);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Đã thêm ${user.name || user.email} vào workspace.`);
      refetch();
      router.refresh();
    });
  }

  if (!canCheck) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <AlertTriangle className="size-8 text-amber-500/70" />
        <p className="max-w-md text-sm text-muted-foreground">
          Chưa thể kiểm tra người dùng mới đăng ký — tính năng này cần áp dụng migration cơ sở dữ liệu
          (<code className="text-xs">0009_members_directory.sql</code>) trước.
        </p>
      </div>
    );
  }

  const isBusy = isSearching || isAdding;
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
            aria-label="Tìm người dùng mới đăng ký"
          />
        </div>
      )}

      {loadError ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <AlertTriangle className="size-8 text-destructive/60" />
          <p className="text-sm text-muted-foreground">Không tải được danh sách người dùng mới đăng ký.</p>
          <Button size="sm" variant="outline" onClick={refetch}>
            Thử lại
          </Button>
        </div>
      ) : result.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          {hasSearch ? (
            <>
              <Search className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Không tìm thấy người dùng phù hợp.</p>
            </>
          ) : (
            <>
              <UserX className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Không có người dùng mới đăng ký nào chưa thuộc workspace này.
              </p>
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
                  <th className="pb-2 font-medium">Người dùng</th>
                  <th className="pb-2 font-medium">Đăng ký</th>
                  <th className="pb-2 font-medium">Vai trò khi thêm</th>
                  <th className="pb-2 font-medium sr-only">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.items.map((u) => (
                  <tr key={u.userId}>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-8 shrink-0">
                          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />}
                          <AvatarFallback className="text-xs">{initialOf(u.name, u.email)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.name || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="py-3 pr-3">
                      <Select
                        value={roleByUser[u.userId] ?? "viewer"}
                        onValueChange={(v) => setRoleByUser((prev) => ({ ...prev, [u.userId]: v as MembershipRole }))}
                      >
                        <SelectTrigger className="w-28" aria-label={`Vai trò cho ${u.name || u.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 text-right">
                      <Button size="sm" variant="outline" disabled={isAdding} onClick={() => handleAdd(u)}>
                        {addingUserId === u.userId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserPlus className="size-4" />
                        )}
                        Thêm vào workspace
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {result.items.map((u) => (
              <div key={u.userId} className="flex flex-col gap-3 rounded-lg ring-1 ring-border p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="size-9 shrink-0">
                    {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />}
                    <AvatarFallback className="text-xs">{initialOf(u.name, u.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={roleByUser[u.userId] ?? "viewer"}
                    onValueChange={(v) => setRoleByUser((prev) => ({ ...prev, [u.userId]: v as MembershipRole }))}
                  >
                    <SelectTrigger className="flex-1" aria-label={`Vai trò cho ${u.name || u.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={isAdding} onClick={() => handleAdd(u)}>
                    {addingUserId === u.userId ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    Thêm
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loadError && (
        <PaginationControls
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          onPageChange={(p) => load(search, p)}
          disabled={isBusy}
        />
      )}
    </div>
  );
}
