"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Pencil, Trash2, Copy, ImageIcon, Plus, GalleryHorizontal, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { DashboardBannerFormDialog } from "@/components/dashboard/dashboard-banner-form-dialog";
import {
  deleteDashboardBanner,
  toggleDashboardBannerActive,
  reorderDashboardBanners,
  duplicateDashboardBanner,
} from "@/lib/dashboard/actions";
import { simplifyRatio } from "@/lib/dashboard/banner-frame";
import type { DashboardBanner } from "@/types/dashboard";

export function DashboardBannersManager({ workspaceId, banners }: { workspaceId: string; banners: DashboardBanner[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<DashboardBanner | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<DashboardBanner | null>(null);
  const [query, setQuery] = useState("");

  const filteredBanners = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banners;
    return banners.filter(
      (b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
    );
  }, [banners, query]);

  function openCreate() {
    setEditingBanner(null);
    setFormOpen(true);
  }

  function openEdit(banner: DashboardBanner) {
    setEditingBanner(banner);
    setFormOpen(true);
  }

  function handleToggleActive(banner: DashboardBanner, next: boolean) {
    startTransition(async () => {
      const result = await toggleDashboardBannerActive(banner.id, next);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;
    const nextOrder = banners.map((b) => b.id);
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];

    startTransition(async () => {
      const result = await reorderDashboardBanners(nextOrder);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDuplicate(banner: DashboardBanner) {
    setDuplicatingId(banner.id);
    startTransition(async () => {
      try {
        const result = await duplicateDashboardBanner(banner.id);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Đã nhân bản banner (đang tắt — bật lên khi sẵn sàng).");
        router.refresh();
      } finally {
        setDuplicatingId(null);
      }
    });
  }

  function handleDelete() {
    if (!deletingBanner) return;
    const banner = deletingBanner;
    startTransition(async () => {
      const result = await deleteDashboardBanner(banner.id, banner.imagePath, banner.mobileImagePath);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã xoá banner.");
      setDeletingBanner(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Banner Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Banner lớn</span> — carousel ở cột trái Dashboard. Quản lý
            các banner luân phiên hiển thị; chỉ banner đang bật mới xuất hiện.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Thêm banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontal}
          title="Chưa có banner nào"
          description="Thêm banner đầu tiên để thay thế khối giới thiệu tĩnh trên Dashboard."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Thêm banner
            </Button>
          }
        />
      ) : (
        <>
          {banners.length > 4 && (
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tiêu đề hoặc mô tả..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          )}

          {filteredBanners.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy banner phù hợp.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredBanners.map((banner) => {
                const index = banners.findIndex((b) => b.id === banner.id);
                return (
                  <div
                    key={banner.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        aria-label="Di chuyển lên"
                        disabled={index === 0 || isPending}
                        onClick={() => handleMove(index, -1)}
                        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Di chuyển xuống"
                        disabled={index === banners.length - 1 || isPending}
                        onClick={() => handleMove(index, 1)}
                        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>

                    <span className="aspect-[2/1] h-12 shrink-0 overflow-hidden rounded-md bg-muted/40">
                      {banner.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                        <img
                          src={banner.imageUrl}
                          alt=""
                          className="size-full object-cover"
                          style={{ objectPosition: `${banner.focalX}% ${banner.focalY}%` }}
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center">
                          <ImageIcon className="size-4 text-muted-foreground" />
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{banner.title}</p>
                      {banner.description && <p className="truncate text-xs text-muted-foreground">{banner.description}</p>}
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">Vị trí {index + 1}</span>
                        {banner.imageWidth && banner.imageHeight && (
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            · {banner.imageWidth}×{banner.imageHeight} px ({simplifyRatio(banner.imageWidth, banner.imageHeight)})
                          </span>
                        )}
                        {banner.mobileImagePath && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Có ảnh mobile riêng
                          </Badge>
                        )}
                        {banner.ctaLabel && banner.ctaUrl ? (
                          <span className="truncate text-[11px] text-muted-foreground">
                            · CTA: {banner.ctaLabel} → {banner.ctaUrl}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">· Không có CTA</span>
                        )}
                      </div>
                    </div>

                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={banner.isActive}
                        onCheckedChange={(checked) => handleToggleActive(banner, checked === true)}
                        disabled={isPending}
                      />
                      Đang bật
                    </label>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label="Chỉnh sửa" onClick={() => openEdit(banner)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Nhân bản"
                        disabled={duplicatingId === banner.id}
                        onClick={() => handleDuplicate(banner)}
                      >
                        {duplicatingId === banner.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Xoá" onClick={() => setDeletingBanner(banner)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <DashboardBannerFormDialog
        workspaceId={workspaceId}
        open={formOpen}
        onOpenChange={setFormOpen}
        banner={editingBanner}
        banners={banners}
      />

      <AlertDialog open={deletingBanner !== null} onOpenChange={(open) => !open && setDeletingBanner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá banner?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deletingBanner?.title}&quot; sẽ bị xoá vĩnh viễn khỏi Dashboard. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
