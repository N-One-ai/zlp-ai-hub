"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Eye, Loader2, MoreVertical, Palette, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { BrandFormDialog } from "@/components/brand/brand-form-dialog";
import { archiveBrand } from "@/lib/brand/actions";
import type { Brand, BrandReadiness } from "@/types/brand";

export interface BrandListItem {
  brand: Brand;
  readiness: BrandReadiness;
  colorCount: number;
  logoCount: number;
  hasFonts: boolean;
}

/** Below this count, a search box adds friction without helping — the
 * whole grid is already scannable at a glance. */
const SEARCH_THRESHOLD = 6;

function ArchiveDialog({
  target,
  isPending,
  onConfirm,
  onOpenChange,
}: {
  target: Brand | null;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lưu trữ thương hiệu?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{target?.name}&quot; sẽ được đánh dấu đã lưu trữ và ẩn khỏi các lựa chọn tạo nội dung mới. Dữ liệu
            guideline vẫn được giữ nguyên và bạn vẫn có thể xem lại sau.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Lưu trữ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BrandCard({
  item,
  isPending,
  onRequestArchive,
}: {
  item: BrandListItem;
  isPending: boolean;
  onRequestArchive: (brand: Brand) => void;
}) {
  const { brand, readiness, colorCount, logoCount, hasFonts } = item;
  const isArchived = brand.status === "archived";

  return (
    <Link href={`/brands/${brand.id}`} className="group block h-full outline-none">
      <Card className="h-full ring-1 ring-border transition-all group-hover:ring-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="size-11 shrink-0">
              {brand.avatarUrl && <AvatarImage src={brand.avatarUrl} alt={brand.name} />}
              <AvatarFallback className="bg-gradient-to-br from-primary/40 to-accent/40 font-medium">
                {brand.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-snug">{brand.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {isArchived && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Đã lưu trữ
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    readiness.isReady
                      ? "border-emerald-600/30 text-emerald-700 dark:text-emerald-400"
                      : "border-amber-600/40 text-amber-700 dark:text-amber-400"
                  }
                >
                  {readiness.isReady ? "Đã cấu hình" : "Chưa hoàn thiện"}
                </Badge>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Thao tác với ${brand.name}`}
                  disabled={isPending}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem render={<Link href={`/brands/${brand.id}`} />}>
                    <Eye className="size-4" />
                    Xem / chỉnh sửa
                  </DropdownMenuItem>
                  {!isArchived && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onRequestArchive(brand)}>
                        <Archive className="size-4" />
                        Lưu trữ
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{brand.description || "Chưa có mô tả."}</p>

          {(colorCount > 0 || logoCount > 0 || hasFonts) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {logoCount > 0 && (
                <span className="rounded-md bg-muted px-1.5 py-0.5">
                  {logoCount} logo
                </span>
              )}
              {colorCount > 0 && (
                <span className="rounded-md bg-muted px-1.5 py-0.5">
                  {colorCount} màu
                </span>
              )}
              {hasFonts && <span className="rounded-md bg-muted px-1.5 py-0.5">Đã đặt font</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function BrandsGrid({ items, workspaceId }: { items: BrandListItem[]; workspaceId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Brand | null>(null);
  const [isPending, startTransition] = useTransition();

  const showSearch = items.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.brand.name.toLowerCase().includes(q));
  }, [items, search]);

  function handleConfirmArchive() {
    if (!archiveTarget) return;
    const target = archiveTarget;
    startTransition(async () => {
      const result = await archiveBrand(target.id);
      if (!result.ok) {
        toast.error(result.error.message);
        setArchiveTarget(null);
        return;
      }
      toast.success(`Đã lưu trữ "${target.name}".`);
      setArchiveTarget(null);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Palette}
        title="Chưa có thương hiệu nào"
        description="Tạo thương hiệu đầu tiên để bắt đầu cấu hình logo, màu, font và preset kích thước."
        action={<BrandFormDialog workspaceId={workspaceId} />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {showSearch && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên thương hiệu..."
            className="pl-9"
            aria-label="Tìm thương hiệu"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Settings2 className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Không tìm thấy thương hiệu phù hợp.</p>
          <Button size="sm" variant="outline" onClick={() => setSearch("")}>
            Xoá tìm kiếm
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <BrandCard key={item.brand.id} item={item} isPending={isPending} onRequestArchive={setArchiveTarget} />
          ))}
        </div>
      )}

      <ArchiveDialog
        target={archiveTarget}
        isPending={isPending}
        onConfirm={handleConfirmArchive}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      />
    </div>
  );
}
