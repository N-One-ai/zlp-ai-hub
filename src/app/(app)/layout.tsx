import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, getMyWorkspaces, getActiveWorkspace } from "@/lib/workspace/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects unauthenticated requests away from these
  // routes — this is the second, independent check: no session, or a
  // session with no active workspace (shouldn't normally happen, signup
  // bootstraps one, but never assumed), both fall back to /login rather
  // than rendering a shell with nothing to show.
  const [user, workspaces, activeWorkspace] = await Promise.all([
    getCurrentUser(),
    getMyWorkspaces(),
    getActiveWorkspace(),
  ]);

  if (!user || !activeWorkspace) {
    redirect("/login");
  }

  return (
    <AppShell user={user} workspaces={workspaces} activeWorkspace={activeWorkspace}>
      {children}
    </AppShell>
  );
}
