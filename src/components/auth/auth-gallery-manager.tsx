"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Trash2, Upload, Images, Loader2, GalleryHorizontal, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  uploadAuthGalleryImage,
  discardAuthGalleryImage,
  addAuthGalleryImageFromUpload,
  addAuthGalleryImageFromAsset,
  toggleAuthGalleryImageActive,
  reorderAuthGalleryImages,
  deleteAuthGalleryImage,
  setAuthGalleryEnabled,
} from "@/lib/auth-gallery/actions";
import { AUTH_GALLERY_ALLOWED_TYPES, AUTH_GALLERY_MAX_BYTES } from "@/lib/auth-gallery/storage";
import { readImageDimensions } from "@/lib/dashboard/read-image-dimensions";
import type { AuthGalleryImageAdmin } from "@/types/auth-gallery";
import type { LibraryAssetListItem } from "@/types/library";

function LibraryPickerDialog({
  open,
  onOpenChange,
  libraryAssets,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryAssets: LibraryAssetListItem[];
  onPicked: () => void;
}) {
  const router = useRouter();
  const [pickingId, setPickingId] = useState<string | null>(null);

  function handlePick(assetId: string) {
    setPickingId(assetId);
    void (async () => {
      const result = await addAuthGalleryImageFromAsset({ assetId });
      setPickingId(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã thêm ảnh từ thư viện vào gallery.");
      onPicked();
      router.refresh();
    })();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chọn ảnh từ thư viện</DialogTitle>
          <DialogDescription>Ảnh được sao chép vào gallery công khai — ảnh gốc trong thư viện không đổi.</DialogDescription>
        </DialogHeader>
        {libraryAssets.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Thư viện chưa có ảnh nào.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {libraryAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                disabled={pickingId !== null}
                onClick={() => handlePick(asset.id)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border ring-1 ring-transparent transition hover:ring-primary disabled:opacity-60"
              >
                {asset.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={asset.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center bg-muted/40">
                    <ImageIcon className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                  {pickingId === asset.id ? <Loader2 className="size-4 animate-spin" /> : "Chọn"}
                </span>
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-left text-[10px] text-white">
                  {asset.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AuthGalleryManager({
  images,
  isEnabled,
  libraryAssets,
}: {
  images: AuthGalleryImageAdmin[];
  isEnabled: boolean;
  libraryAssets: LibraryAssetListItem[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deletingImage, setDeletingImage] = useState<AuthGalleryImageAdmin | null>(null);
  const [enabledOptimistic, setEnabledOptimistic] = useState(isEnabled);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!AUTH_GALLERY_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Định dạng không hỗ trợ. Dùng PNG, JPG hoặc WEBP.");
      return;
    }
    if (file.size > AUTH_GALLERY_MAX_BYTES) {
      toast.error("File quá lớn. Tối đa 5MB.");
      return;
    }

    setUploading(true);
    try {
      const dimensions = await readImageDimensions(file).catch(() => null);
      const uploadResult = await uploadAuthGalleryImage(file);
      if (!uploadResult.ok) {
        toast.error(uploadResult.error.message);
        return;
      }
      const addResult = await addAuthGalleryImageFromUpload({
        imagePath: uploadResult.data.path,
        imageWidth: dimensions?.width ?? null,
        imageHeight: dimensions?.height ?? null,
      });
      if (!addResult.ok) {
        await discardAuthGalleryImage(uploadResult.data.path);
        toast.error(addResult.error.message);
        return;
      }
      toast.success("Đã thêm ảnh vào gallery.");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleToggleActive(image: AuthGalleryImageAdmin, next: boolean) {
    startTransition(async () => {
      const result = await toggleAuthGalleryImageActive(image.id, next);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const nextOrder = images.map((img) => img.id);
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];

    startTransition(async () => {
      const result = await reorderAuthGalleryImages(nextOrder);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deletingImage) return;
    const image = deletingImage;
    startTransition(async () => {
      const result = await deleteAuthGalleryImage(image.id, image.imagePath);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã xoá ảnh khỏi gallery.");
      setDeletingImage(null);
      router.refresh();
    });
  }

  function handleToggleEnabled(next: boolean) {
    setEnabledOptimistic(next);
    startTransition(async () => {
      const result = await setAuthGalleryEnabled(next);
      if (!result.ok) {
        setEnabledOptimistic(!next);
        toast.error(result.error.message);
        return;
      }
      toast.success(next ? "Đã bật gallery." : "Đã tắt gallery.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Gallery trang Đăng nhập / Đăng ký</h1>
          <p className="text-sm text-muted-foreground">
            Danh sách ảnh dùng chung — áp dụng cho cả <span className="font-medium text-foreground">/login</span> và{" "}
            <span className="font-medium text-foreground">/register</span>, hiển thị với mọi người truy cập (kể cả
            chưa đăng nhập).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={enabledOptimistic}
            onCheckedChange={(checked) => handleToggleEnabled(checked === true)}
            disabled={isPending}
          />
          {enabledOptimistic ? "Gallery đang bật" : "Gallery đang tắt"}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Tải ảnh lên
        </Button>
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          <Images className="size-4" />
          Chọn từ thư viện
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={AUTH_GALLERY_ALLOWED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {images.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontal}
          title="Gallery chưa có ảnh nào"
          description="Tải ảnh lên hoặc chọn từ thư viện để hiển thị trên trang Đăng nhập/Đăng ký."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {images.map((image, index) => (
            <div key={image.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
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
                  disabled={index === images.length - 1 || isPending}
                  onClick={() => handleMove(index, 1)}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>

              <span className="size-14 shrink-0 overflow-hidden rounded-md bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element -- public bucket URL, no optimization needed */}
                <img src={image.imageUrl} alt="" className="size-full object-cover" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Vị trí {index + 1}</p>
                {image.imageWidth && image.imageHeight && (
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {image.imageWidth}×{image.imageHeight} px
                  </p>
                )}
              </div>

              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={image.isActive}
                  onCheckedChange={(checked) => handleToggleActive(image, checked === true)}
                  disabled={isPending}
                />
                Đang bật
              </label>

              <Button size="icon-sm" variant="ghost" aria-label="Xoá" onClick={() => setDeletingImage(image)}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <LibraryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        libraryAssets={libraryAssets}
        onPicked={() => setPickerOpen(false)}
      />

      <AlertDialog open={deletingImage !== null} onOpenChange={(open) => !open && setDeletingImage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá ảnh khỏi gallery?</AlertDialogTitle>
            <AlertDialogDescription>
              Ảnh sẽ không còn hiển thị trên trang Đăng nhập/Đăng ký. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive text-white hover:bg-destructive/90">
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
