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
