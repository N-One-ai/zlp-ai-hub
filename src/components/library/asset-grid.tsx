"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  List,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { deleteAsset } from "@/lib/library/actions";
import { trackEvent } from "@/lib/analytics/track";
import { ASSET_STATUS_LABEL, ASSET_TYPE_LABEL } from "@/lib/library/labels";
import type { LibraryAssetListItem } from "@/types/library";

const STATUS_BADGE_CLASS: Record<LibraryAssetListItem["status"], string> = {
  ready: "border-success/40 text-success bg-success/10",
  draft: "border-warning/40 text-warning bg-warning/10",
  archived: "border-border text-muted-foreground bg-muted",
};

function TypeIcon({ type, className }: { type: LibraryAssetListItem["type"]; className?: string }) {
  return type === "banner" ? <LayoutTemplate className={className} /> : <ImageIcon className={className} />;
}

/** Real, honest placeholder for an asset with no storage_path yet — never
 * a guessed "processing"/"failed" state the data can't actually support.
 * A 'banner' asset genuinely has no file until its export step runs
 * (createBannerAsset only ever writes the design_documents layers, not a
 * rendered image); any other missing thumbnail is just as truthfully
 * "no preview available" — this app has no background worker, so a
 * creative_assets row for an 'image' only ever exists once generation
 * already succeeded (see migration 0004's comment on the table). */
function NoPreview({ type }: { type: LibraryAssetListItem["type"] }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
      <TypeIcon type={type} className="size-6" />
      <span className="px-2 text-center text-[11px] font-medium leading-tight">
        {type === "banner" ? "Chưa xuất bản xem trước" : "Chưa có bản xem trước"}
      </span>
    </div>
  );
}

function AssetThumb({ asset, className }: { asset: LibraryAssetListItem; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-muted/40", className)}>
      {asset.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={asset.thumbnailUrl} alt={asset.name || "Tài sản chưa đặt tên"} className="max-h-full max-w-full object-contain" />
      ) : (
        <NoPreview type={asset.type} />
      )}
    </div>
  );
}

function AssetActions({
  asset,
  canDelete,
  isPending,
  onRequestDelete,
}: {
  asset: LibraryAssetListItem;
  canDelete: boolean;
  isPending: boolean;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={`Thao tác với ${asset.name || "tài sản"}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem render={<Link href={`/library/${asset.id}`} />}>
          <Eye className="size-4" />
          Mở
        </DropdownMenuItem>
        {asset.thumbnailUrl && (
          <DropdownMenuItem
            render={
              <a
                href={asset.thumbnailUrl}
                download
                onClick={() => void trackEvent({ name: "asset_downloaded", assetId: asset.id, assetType: asset.type })}
              />
            }
          >
            <Download className="size-4" />
            Tải xuống
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(asset)}>
              <Trash2 className="size-4" />
              Xoá
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GridCard({
  asset,
  canDelete,
  isPending,
  onRequestDelete,
}: {
  asset: LibraryAssetListItem;
  canDelete: boolean;
  isPending: boolean;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
}) {
  return (
    <Link
      href={`/library/${asset.id}`}
      className="group flex flex-col rounded-xl ring-1 ring-border overflow-hidden bg-card outline-none transition-all hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative">
        <AssetThumb asset={asset} className="aspect-square w-full" />
        <Badge variant="outline" className={cn("absolute top-2 right-2 backdrop-blur-sm", STATUS_BADGE_CLASS[asset.status])}>
          {ASSET_STATUS_LABEL[asset.status]}
        </Badge>
      </div>
      <div className="flex items-start gap-1.5 px-3 pt-2.5 pb-1">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{asset.name || "Chưa đặt tên"}</span>
        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <AssetActions asset={asset} canDelete={canDelete} isPending={isPending} onRequestDelete={onRequestDelete} />
        </div>
      </div>
      <div className="flex items-center gap-1 px-3 pb-2.5 text-xs text-muted-foreground">
        <span className="truncate">{asset.brandName}</span>
        <span>·</span>
        <span className="shrink-0">{ASSET_TYPE_LABEL[asset.type]}</span>
      </div>
    </Link>
  );
}

function ListRow({
  asset,
  canDelete,
  isPending,
  onRequestDelete,
}: {
  asset: LibraryAssetListItem;
  canDelete: boolean;
  isPending: boolean;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
}) {
  return (
    <Link
      href={`/library/${asset.id}`}
      className="group flex items-center gap-3 rounded-xl ring-1 ring-border bg-card px-3 py-2.5 outline-none transition-all hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <AssetThumb asset={asset} className="size-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{asset.name || "Chưa đặt tên"}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <span className="truncate">{asset.brandName}</span>
          <span>·</span>
          <span className="shrink-0">{ASSET_TYPE_LABEL[asset.type]}</span>
        </p>
      </div>
      <Badge variant="outline" className={cn("hidden sm:inline-flex shrink-0", STATUS_BADGE_CLASS[asset.status])}>
        {ASSET_STATUS_LABEL[asset.status]}
      </Badge>
      <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground md:inline">
        {new Date(asset.createdAt).toLocaleDateString("vi-VN")}
      </span>
      <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <AssetActions asset={asset} canDelete={canDelete} isPending={isPending} onRequestDelete={onRequestDelete} />
      </div>
    </Link>
  );
}

export function AssetGrid({
  assets,
  currentUserId,
  isAdmin,
}: {
  assets: LibraryAssetListItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [deleteTarget, setDeleteTarget] = useState<LibraryAssetListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  if (assets.length === 0) return null;

  function canDelete(asset: LibraryAssetListItem) {
    return isAdmin || asset.ownerId === currentUserId;
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const result = await deleteAsset(target.id);
      if (!result.ok) {
        toast.error(result.error.message);
        setDeleteTarget(null);
        return;
      }
      toast.success(`Đã xoá "${target.name || "tài sản"}".`);
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="inline-flex items-center rounded-lg bg-muted p-[3px]">
          <button
            type="button"
            aria-pressed={view === "grid"}
            aria-label="Xem dạng lưới"
            onClick={() => setView("grid")}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors",
              view === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            aria-label="Xem dạng danh sách"
            onClick={() => setView("list")}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors",
              view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {assets.map((asset) => (
            <GridCard
              key={asset.id}
              asset={asset}
              canDelete={canDelete(asset)}
              isPending={isPending}
              onRequestDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {assets.map((asset) => (
            <ListRow
              key={asset.id}
              asset={asset}
              canDelete={canDelete(asset)}
              isPending={isPending}
              onRequestDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài sản này?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name || "Tài sản chưa đặt tên"}&quot; sẽ bị xoá khỏi thư viện vĩnh viễn, cùng với file
              lưu trữ liên quan. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
