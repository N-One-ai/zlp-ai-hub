"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Brand } from "@/types/brand";
import type { MemberWithProfile } from "@/types/workspace";

const ALL = "__all__";

export function LibraryFilters({ brands, members }: { brands: Brand[]; members: MemberWithProfile[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("search", value.trim() || null), 300);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Tìm theo tên, prompt, chiến dịch..."
          className="pl-9"
        />
      </div>

      <Select value={searchParams.get("type") ?? ALL} onValueChange={(v) => updateParam("type", v)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Loại" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi loại</SelectItem>
          <SelectItem value="image">Ảnh</SelectItem>
          <SelectItem value="banner">Banner</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("brandId") ?? ALL} onValueChange={(v) => updateParam("brandId", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Thương hiệu" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi thương hiệu</SelectItem>
          {brands.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("ownerId") ?? ALL} onValueChange={(v) => updateParam("ownerId", v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Người tạo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi người tạo</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name || m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") ?? ALL} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
          <SelectItem value="draft">Nháp</SelectItem>
          <SelectItem value="ready">Hoàn tất</SelectItem>
          <SelectItem value="archived">Lưu trữ</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("sort") ?? "newest"} onValueChange={(v) => updateParam("sort", v)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Mới nhất</SelectItem>
          <SelectItem value="oldest">Cũ nhất</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
