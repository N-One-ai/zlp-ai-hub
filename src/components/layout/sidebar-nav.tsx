"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Image as ImageIcon, LayoutTemplate, Library, Palette, Users, Settings, UserRound, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MembershipRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const GROUPS: { label: string; items: NavItem[]; adminOnly?: boolean }[] = [
  {
    label: "Tạo",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/create/image", label: "Tạo ảnh", icon: ImageIcon },
      { href: "/create/banner", label: "Tạo banner", icon: LayoutTemplate },
      { href: "/create/character", label: "Xây dựng nhân vật", icon: UserRound },
      { href: "/create/voice", label: "Tạo giọng nói", icon: Mic },
    ],
  },
  {
    label: "Nội dung",
    items: [{ href: "/library", label: "Thư viện", icon: Library }],
  },
  {
    label: "Quản trị",
    adminOnly: true,
    items: [
      { href: "/brands", label: "Thương hiệu", icon: Palette },
      { href: "/members", label: "Thành viên", icon: Users },
    ],
  },
  {
    label: "Khác",
    items: [{ href: "/settings", label: "Cài đặt", icon: Settings }],
  },
];

/** Plain <a> tags, not next/link — every page under here re-reads the
 * active workspace server-side on each navigation, so a full request
 * keeps that always correct rather than relying on client Router Cache
 * staleness behaving the way we expect. */
export function SidebarNav({
  role,
  collapsed = false,
  className,
  id,
}: {
  role: MembershipRole;
  collapsed?: boolean;
  className?: string;
  id?: string;
}) {
  const pathname = usePathname();

  return (
    <nav id={id} className={cn("flex flex-col gap-5 overflow-y-auto overflow-x-hidden", className)}>
      {GROUPS.filter((g) => !g.adminOnly || role === "admin").map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {!collapsed && (
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </span>
          )}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const linkClassName = cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              collapsed && "justify-center px-0",
              active
                ? "bg-sidebar-accent text-sidebar-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-primary"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            );
            const content = (
              <>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-icon",
                    active ? "bg-sidebar-primary/15 text-sidebar-primary" : "bg-sidebar-accent/70"
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            );

            if (!collapsed) {
              return (
                <a key={href} href={href} aria-current={active ? "page" : undefined} className={linkClassName}>
                  {content}
                </a>
              );
            }

            return (
              <Tooltip key={href}>
                <TooltipTrigger
                  render={<a href={href} aria-current={active ? "page" : undefined} className={linkClassName} />}
                >
                  {content}
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
