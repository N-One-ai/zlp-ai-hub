"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, Settings, Plus, Image as ImageIcon, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Thư viện", icon: Library },
] as const;

/** Compact bottom nav for mobile (PRD §9: "điều hướng chính gọn"). Admin-
 * only screens (Thương hiệu, Thành viên) are reached from /settings on
 * mobile rather than taking a bottom-nav slot. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background">
      <ul className="grid grid-cols-4 items-center">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex justify-center">
              <a
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 py-2.5 px-3 min-w-11 min-h-11 justify-center"
              >
                <Icon className={cn("size-5", active ? "text-foreground" : "text-muted-foreground")} />
              </a>
            </li>
          );
        })}
        <li className="flex justify-center">
          <Popover>
            <PopoverTrigger
              aria-label="Tạo mới"
              className="flex items-center justify-center size-11 rounded-full bg-primary text-primary-foreground -translate-y-3 shadow-md"
            >
              <Plus className="size-5" />
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-44 p-1">
              <Link
                href="/create/image"
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent"
              >
                <ImageIcon className="size-4" />
                Tạo ảnh
              </Link>
              <Link
                href="/create/banner"
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent"
              >
                <LayoutTemplate className="size-4" />
                Tạo banner
              </Link>
            </PopoverContent>
          </Popover>
        </li>
        <li className="flex justify-center">
          <a
            href="/settings"
            aria-label="Cài đặt"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 py-2.5 px-3 min-w-11 min-h-11 justify-center"
          >
            <Settings className={cn("size-5", pathname === "/settings" ? "text-foreground" : "text-muted-foreground")} />
          </a>
        </li>
      </ul>
    </nav>
  );
}
