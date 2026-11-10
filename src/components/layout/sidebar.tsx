"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarNav } from "./sidebar-nav";
import { ZalopayZIcon } from "./zalopay-z-icon";
import type { MembershipRole } from "@/types/database";

const COLLAPSE_STORAGE_KEY = "creative-hub:sidebar-collapsed";

/** useSyncExternalStore (not useState+useEffect) is the one hook React
 * itself documents for "read a browser-only value like localStorage
 * without a hydration mismatch": getServerSnapshot always returns false,
 * so SSR and the first client paint agree, and the real saved value
 * takes over right after — no flash-then-jump render visible as a
 * separate step, and no lint complaint about setState-in-effect either.
 * Listeners are notified manually on write (a same-tab localStorage
 * write never fires the browser's own "storage" event), same idea as
 * model-picker.tsx's localStorage convenience, just shared across every
 * Sidebar instance instead of per-field. */
let collapseListeners: Array<() => void> = [];

function subscribeCollapsed(onChange: () => void) {
  collapseListeners.push(onChange);
  return () => {
    collapseListeners = collapseListeners.filter((l) => l !== onChange);
  };
}

function getCollapsedSnapshot() {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCollapsedServerSnapshot() {
  return false;
}

function setCollapsedStorage(next: boolean) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // best-effort persistence only
  }
  collapseListeners.forEach((l) => l());
}

/** Desktop-only collapse — mobile already gets its own drawer-equivalent
 * (MobileNav's bottom bar), so this component's own state/markup never
 * renders below the md breakpoint (see the `hidden md:flex` on <aside>). */
export function Sidebar({ role }: { role: MembershipRole }) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, getCollapsedServerSnapshot);

  function toggle() {
    setCollapsedStorage(!collapsed);
  }

  const toggleButtonClassName = cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/60 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    collapsed && "justify-center px-0"
  );
  const toggleButtonContent = collapsed ? (
    <PanelLeftOpen className="size-4 shrink-0" />
  ) : (
    <>
      <PanelLeftClose className="size-4 shrink-0" />
      <span>Thu gọn</span>
    </>
  );

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "hidden md:flex md:shrink-0 md:flex-col md:bg-sidebar md:text-sidebar-foreground md:border-r md:border-sidebar-border md:py-5 md:gap-4 transition-[width] duration-200 ease-out",
          collapsed ? "md:w-[76px] md:px-2" : "md:w-64 md:px-3"
        )}
      >
        <div className={cn("flex items-center gap-2.5 px-2", collapsed && "justify-center px-0")}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2a56e8] to-[#001c6e] text-white shadow-sm shadow-[#0033c9]/40 ring-1 ring-white/10">
            <ZalopayZIcon className="size-4" />
          </div>
          {!collapsed && (
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
          )}
        </div>

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Mở rộng sidebar"
                  aria-expanded={false}
                  aria-controls="app-sidebar-nav"
                  className={toggleButtonClassName}
                />
              }
            >
              {toggleButtonContent}
            </TooltipTrigger>
            <TooltipContent side="right">Mở rộng sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-label="Thu gọn sidebar"
            aria-expanded={true}
            aria-controls="app-sidebar-nav"
            className={toggleButtonClassName}
          >
            {toggleButtonContent}
          </button>
        )}

        <SidebarNav id="app-sidebar-nav" role={role} collapsed={collapsed} className="flex-1" />
      </aside>
    </TooltipProvider>
  );
}
