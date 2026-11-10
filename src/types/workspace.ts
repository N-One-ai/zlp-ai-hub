import type { MembershipRole, MembershipStatus } from "./database";

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: MembershipRole;
  status: MembershipStatus;
}

export interface MemberWithProfile {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: string;
}

/** A signed-up account with no membership row in the workspace being
 * viewed (any status) — "mới đăng ký, chưa thuộc workspace". `createdAt`
 * is `profiles.created_at`, the real signup timestamp — never fabricated. */
export interface UnassignedUser {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** True when this came from the DB-level search_* RPC (migration 0009).
   * False means the RPC isn't available yet (migration not applied) and
   * this fell back to the plain, pre-existing, unpaginated query —
   * search/pagination still work, just computed in the server action
   * instead of the database. Surfaced so the UI can disclose it instead
   * of silently pretending everything is backend-paginated. */
  backendPaginated: boolean;
}
