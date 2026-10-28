import { SidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserMenu } from "./user-menu";
import { ZalopayZIcon } from "./zalopay-z-icon";
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
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:bg-sidebar md:text-sidebar-foreground md:border-r md:border-sidebar-border md:px-3 md:py-5 md:gap-6">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2a56e8] to-[#001c6e] text-white shadow-sm shadow-[#0033c9]/40 ring-1 ring-white/10">
            <ZalopayZIcon className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, no optimization needed */}
              <img src="/brand/zalopay-logo.svg" alt="Zalopay" className="h-5 w-auto" />
              <span className="inline-flex items-center rounded-md bg-gradient-to-r from-primary to-accent px-1.5 py-[1px] text-[10px] font-bold text-primary-foreground">
                AI
              </span>
            </div>
            <span className="text-[11px] text-sidebar-foreground/55">Creative Platform</span>
          </div>
        </div>
        <SidebarNav role={activeWorkspace.role} className="flex-1" />
      </aside>

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
