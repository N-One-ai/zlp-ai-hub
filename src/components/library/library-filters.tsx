"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSET_STATUS_LABEL, ASSET_TYPE_LABEL, SORT_LABEL } from "@/lib/library/labels";
import type { Brand } from "@/types/brand";
import type { MemberWithProfile } from "@/types/workspace";

const ALL = "__all__";

export function LibraryFilters({ brands, members }: { brands: Brand[]; members: MemberWithProfile[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [syncedUrlSearch, setSyncedUrlSearch] = useState(urlSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keeps the input in sync when the URL changes from outside this box —
  // "Xoá bộ lọc" below, or the browser's back/forward. Adjusting state
  // during render (not in an effect) per React's own guidance for
  // resetting local state from an external value change.
  if (urlSearch !== syncedUrlSearch) {
    setSyncedUrlSearch(urlSearch);
    setSearch(urlSearch);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const brandLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of brands) map[b.id] = b.name;
    return map;
  }, [brands]);

  const ownerLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) map[m.userId] = m.name || m.email;
    return map;
  }, [members]);

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

  const hasActiveFilters = !!(
    searchParams.get("search") ||
    searchParams.get("type") ||
    searchParams.get("brandId") ||
    searchParams.get("ownerId") ||
    searchParams.get("status")
  );

  function clearFilters() {
    const params = new URLSearchParams();
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Tìm theo tên, prompt, chiến dịch..."
          className="pl-9"
          aria-label="Tìm tài sản"
        />
      </div>

      <Select value={searchParams.get("type") ?? ALL} onValueChange={(v) => updateParam("type", v)}>
        <SelectTrigger className="w-full sm:w-32" aria-label="Lọc theo loại tài sản">
          <SelectValue>{(v: string) => (v === ALL ? "Tất cả loại" : ASSET_TYPE_LABEL[v as keyof typeof ASSET_TYPE_LABEL] ?? v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả loại</SelectItem>
          <SelectItem value="image">{ASSET_TYPE_LABEL.image}</SelectItem>
          <SelectItem value="banner">{ASSET_TYPE_LABEL.banner}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("brandId") ?? ALL} onValueChange={(v) => updateParam("brandId", v)}>
        <SelectTrigger className="w-full sm:w-40" aria-label="Lọc theo thương hiệu">
          <SelectValue>{(v: string) => (v === ALL ? "Tất cả thương hiệu" : brandLabel[v] ?? v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả thương hiệu</SelectItem>
          {brands.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("ownerId") ?? ALL} onValueChange={(v) => updateParam("ownerId", v)}>
        <SelectTrigger className="w-full sm:w-36" aria-label="Lọc theo người tạo">
          <SelectValue>{(v: string) => (v === ALL ? "Tất cả người tạo" : ownerLabel[v] ?? v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả người tạo</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name || m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") ?? ALL} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-full sm:w-32" aria-label="Lọc theo trạng thái">
          <SelectValue>
            {(v: string) => (v === ALL ? "Tất cả trạng thái" : ASSET_STATUS_LABEL[v as keyof typeof ASSET_STATUS_LABEL] ?? v)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả trạng thái</SelectItem>
          <SelectItem value="draft">{ASSET_STATUS_LABEL.draft}</SelectItem>
          <SelectItem value="ready">{ASSET_STATUS_LABEL.ready}</SelectItem>
          <SelectItem value="archived">{ASSET_STATUS_LABEL.archived}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("sort") ?? "newest"} onValueChange={(v) => updateParam("sort", v)}>
        <SelectTrigger className="w-full sm:w-32" aria-label="Sắp xếp theo">
          <SelectValue>{(v: string) => SORT_LABEL[v as keyof typeof SORT_LABEL] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">{SORT_LABEL.newest}</SelectItem>
          <SelectItem value="oldest">{SORT_LABEL.oldest}</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button size="sm" variant="ghost" onClick={clearFilters} className="text-muted-foreground">
          <X className="size-3.5" />
          Xoá bộ lọc
        </Button>
      )}
    </div>
  );
}
