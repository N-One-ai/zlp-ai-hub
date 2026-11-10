import { Sidebar } from "./sidebar";
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
    <div className="flex min-h-svh bg-background">
      <Sidebar role={activeWorkspace.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/80 backdrop-blur-sm px-4 py-3 md:px-7 md:py-4 sticky top-0 z-30">
          <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspace.workspaceId} />
          <UserMenu name={user.name || user.email} email={user.email} avatarUrl={user.avatarUrl} />
        </header>

        <main className="flex-1 px-4 py-5 pb-28 md:px-7 md:py-7 md:pb-7 w-full max-w-7xl mx-auto flex flex-col gap-6">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
