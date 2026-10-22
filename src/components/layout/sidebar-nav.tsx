"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Image as ImageIcon, LayoutTemplate, Library, Palette, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MembershipRole } from "@/types/database";

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create/image", label: "Tạo ảnh", icon: ImageIcon },
  { href: "/create/banner", label: "Tạo banner", icon: LayoutTemplate },
  { href: "/library", label: "Thư viện", icon: Library },
] as const;

const ADMIN_NAV_ITEMS = [
  { href: "/brands", label: "Thương hiệu", icon: Palette },
  { href: "/members", label: "Thành viên", icon: Users },
] as const;

const SETTINGS_ITEM = { href: "/settings", label: "Cài đặt", icon: Settings } as const;

/** Plain <a> tags, not next/link — every page under here re-reads the
 * active workspace server-side on each navigation, so a full request
 * keeps that always correct rather than relying on client Router Cache
 * staleness behaving the way we expect. */
export function SidebarNav({ role, className }: { role: MembershipRole; className?: string }) {
  const pathname = usePathname();
  const items = [...BASE_NAV_ITEMS, ...(role === "admin" ? ADMIN_NAV_ITEMS : []), SETTINGS_ITEM];

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <a
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
