"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Image as ImageIcon, LayoutTemplate, Library, Palette, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
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
export function SidebarNav({ role, className }: { role: MembershipRole; className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-5 overflow-y-auto", className)}>
      {GROUPS.filter((g) => !g.adminOnly || role === "admin").map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {group.label}
          </span>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/20"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-sidebar-primary-foreground/15" : "bg-sidebar-accent/70"
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span>{label}</span>
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
