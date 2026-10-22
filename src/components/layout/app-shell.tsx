import { SidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserMenu } from "./user-menu";
import type { CurrentUser, WorkspaceMembership } from "@/types/workspace";

export function AppShell({
  user,
  workspaces,
  activeWorkspace,
  children,
}: {
  user: CurrentUser;
  workspaces: WorkspaceMembership[];
  activeWorkspace: WorkspaceMembership;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:px-3 md:py-4 md:gap-4">
        <div className="px-1">
          <span className="font-semibold tracking-tight">Creative Hub</span>
        </div>
        <SidebarNav role={activeWorkspace.role} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
          <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspace.workspaceId} />
          <UserMenu name={user.name || user.email} email={user.email} avatarUrl={user.avatarUrl} />
        </header>

        <main className="flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6 w-full max-w-6xl mx-auto flex flex-col gap-6">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
