"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Eye,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  List,
  Loader2,
  MoreVertical,
  Music,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteAsset, renameAsset } from "@/lib/library/actions";
import { toggleAssetFavorite } from "@/lib/library/favorites-actions";
import { trackEvent } from "@/lib/analytics/track";
import { ASSET_STATUS_LABEL, ASSET_TYPE_LABEL } from "@/lib/library/labels";
import type { LibraryAssetListItem } from "@/types/library";

const STATUS_BADGE_CLASS: Record<LibraryAssetListItem["status"], string> = {
  ready: "border-success/40 text-success bg-success/10",
  draft: "border-warning/40 text-warning bg-warning/10",
  archived: "border-border text-muted-foreground bg-muted",
};

function TypeIcon({ type, className }: { type: LibraryAssetListItem["type"]; className?: string }) {
  if (type === "banner") return <LayoutTemplate className={className} />;
  if (type === "audio") return <Music className={className} />;
  return <ImageIcon className={className} />;
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
        {type === "banner" ? "Chưa xuất bản xem trước" : type === "audio" ? "Chưa có file âm thanh" : "Chưa có bản xem trước"}
      </span>
    </div>
  );
}

/** Audio has no visual thumbnail at all — the file itself (thumbnailUrl,
 * same signed storage_path URL every other type reuses for its preview)
 * is only ever meant to be <audio>'d, never <img>'d. Rendering it through
 * AssetThumb's generic <img> path would make a perfectly fine mp3 file
 * show up as a false "ảnh lỗi", which is worse than just never trying. */
function AudioThumb({ asset, className }: { asset: LibraryAssetListItem; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-muted/40", className)}>
      {asset.thumbnailUrl ? (
        <Music className="size-6 text-primary" />
      ) : (
        <NoPreview type={asset.type} />
      )}
    </div>
  );
}

/** Three real, honest preview states (never a blank box that could be
 * mistaken for a successfully generated — but empty — image):
 * no thumbnailUrl at all -> NoPreview; thumbnailUrl present but still
 * decoding -> a pulsing skeleton behind it; thumbnailUrl present but the
 * request failed (expired signed URL, deleted Storage object, network
 * error) -> a distinct "ảnh lỗi" state, never silently falling back to
 * NoPreview's "chưa có" wording, which would misreport a real failure as
 * "nothing generated yet". */
function AssetThumb({
  asset,
  className,
  onNaturalSize,
}: {
  asset: LibraryAssetListItem;
  className?: string;
  /** Reports the loaded image's real pixel size (only once it actually
   * loads) — used by the compact grid to size a tile to the image's own
   * aspect ratio when that isn't already known from `asset.width`/
   * `asset.height`. */
  onNaturalSize?: (width: number, height: number) => void;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(asset.thumbnailUrl ? "loading" : "loaded");

  if (asset.type === "audio") return <AudioThumb asset={asset} className={className} />;

  if (!asset.thumbnailUrl) {
    return (
      <div className={cn("flex items-center justify-center overflow-hidden bg-muted/40", className)}>
        <NoPreview type={asset.type} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={cn("flex items-center justify-center overflow-hidden bg-destructive/5", className)}>
        <div className="flex flex-col items-center gap-1.5 text-destructive/80">
          <AlertTriangle className="size-6" />
          <span className="px-2 text-center text-[11px] font-medium leading-tight">Không tải được ảnh</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-muted/40", className)}>
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      <img
        src={asset.thumbnailUrl}
        alt={asset.name || "Tài sản chưa đặt tên"}
        className={cn("max-h-full max-w-full object-contain transition-opacity", state === "loading" && "opacity-0")}
        onLoad={(e) => {
          setState("loaded");
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) onNaturalSize?.(naturalWidth, naturalHeight);
        }}
        onError={() => setState("error")}
      />
    </div>
  );
}

function AssetActions({
  asset,
  canDelete,
  isPending,
  onRequestDelete,
  onRequestRename,
}: {
  asset: LibraryAssetListItem;
  canDelete: boolean;
  isPending: boolean;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
  onRequestRename: (asset: LibraryAssetListItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={`Thao tác với ${asset.name || "tài sản"}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
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
          <DropdownMenuItem onClick={() => onRequestRename(asset)}>
            <Pencil className="size-4" />
            Đổi tên
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
  onRequestRename,
}: {
  asset: LibraryAssetListItem;
  canDelete: boolean;
  isPending: boolean;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
  onRequestRename: (asset: LibraryAssetListItem) => void;
}) {
  return (
    <Link
      href={`/library/${asset.id}`}
      className="group flex flex-col rounded-xl overflow-hidden bg-card outline-none transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative">
        <AssetThumb asset={asset} className="aspect-square w-full" />
        <Badge variant="outline" className={cn("absolute top-2 right-2 backdrop-blur-sm", STATUS_BADGE_CLASS[asset.status])}>
          {ASSET_STATUS_LABEL[asset.status]}
        </Badge>
      </div>
      <div className="flex items-start gap-1.5 px-3 pt-2.5 pb-1">
        <span title={asset.name || "Chưa đặt tên"} className="min-w-0 flex-1 truncate text-sm font-medium">
          {asset.name || "Chưa đặt tên"}
        </span>
        {/* Both calls are needed: stopPropagation alone stops this click
         * from reaching the parent <Link>'s own onClick (the one that
         * would otherwise call preventDefault() and do a CLIENT-SIDE
         * navigation instead) — but with that onClick never reached,
         * nothing calls preventDefault(), so the browser's NATIVE "this
         * is inside an <a href>, navigate there" default action still
         * fires a few seconds later as a full page reload once dispatch
         * finishes with defaultPrevented still false. preventDefault()
         * here stops that native fallback navigation too. */}
        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} onPointerDown={(e) => e.stopPropagation()}>
          <AssetActions
            asset={asset}
            canDelete={canDelete}
            isPending={isPending}
            onRequestDelete={onRequestDelete}
            onRequestRename={onRequestRename}
          />
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

/** Heart toggle for the compact grid. Both stopPropagation AND
 * preventDefault on the click are required — stopPropagation alone
 * stops this click from reaching the card's own <Link> onClick (so no
 * client-side navigation), but leaves the browser's native "inside an
 * <a href>, navigate there" default action unprevented, which still
 * fires a few seconds later as a full page reload. preventDefault()
 * here stops that native fallback too. */
function FavoriteButton({ isFavorited, onToggle }: { isFavorited: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={isFavorited ? "Bỏ yêu thích" : "Yêu thích"}
        aria-pressed={isFavorited}
        onClick={onToggle}
        className="flex size-7 items-center justify-center rounded-full bg-background/70 text-foreground/70 backdrop-blur-sm transition-colors hover:text-destructive"
      >
        <Heart className={cn("size-3.5", isFavorited && "fill-destructive text-destructive")} />
      </button>
    </div>
  );
}

/** Smallest/widest a compact tile's aspect ratio is allowed to render
 * at — an extremely tall portrait or ultra-wide panorama would otherwise
 * produce a sliver-thin or row-dominating tile. Clamped tiles fall back
 * to a centered, letterboxed image (dark neutral bars) instead, which is
 * the explicitly accepted tradeoff for those outlier ratios. */
const COMPACT_MIN_RATIO = 0.5;
const COMPACT_MAX_RATIO = 2.2;

/** Thumbnail-only grid card for Dashboard's "Đã tạo gần đây" (see the
 * `compact` prop on AssetGrid) — just the image, the favorite heart, and
 * the existing actions menu, as overlays on the thumbnail itself. No
 * name/brand/type/status text outside or on top of the image. Tapping
 * anywhere on the thumbnail opens the same `/library/[id]` detail page
 * as the full card — nothing about that destination changes, only what
 * the grid tile itself shows.
 *
 * Every tile shares the same HEIGHT (set by AssetGrid's `compact` row,
 * via responsive `h-*` classes) and derives its own WIDTH from the
 * image's real aspect ratio via the CSS `aspect-ratio` property — the
 * browser computes width = height × ratio with no JS layout pass needed.
 * `asset.width`/`height` are used when the DB already has them,
 * otherwise the tile starts square and snaps to the image's actual
 * ratio once it loads (`onNaturalSize`). Meant to sit inside a
 * `flex flex-wrap` row, which naturally wraps tiles of different widths
 * onto the next line as the viewport narrows. */
function CompactGridCard({
  asset,
  canDelete,
  isPending,
  isFavorited,
  onToggleFavorite,
  onRequestDelete,
  onRequestRename,
  ratio,
  height,
  onNaturalSize,
}: {
  asset: LibraryAssetListItem;
  canDelete: boolean;
  isPending: boolean;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
  onRequestRename: (asset: LibraryAssetListItem) => void;
  /** Clamped aspect ratio and shared row height, both computed a level up
   * by CompactAssetGrid's justified-row layout — every tile in a row
   * shares `height`; width falls out of the CSS `aspect-ratio` property
   * (width = height × ratio) with no JS layout math needed per tile. */
  ratio: number;
  height: number;
  onNaturalSize: (width: number, height: number) => void;
}) {
  return (
    <Link
      href={`/library/${asset.id}`}
      style={{ aspectRatio: ratio, height }}
      className="group relative block shrink-0 overflow-hidden outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AssetThumb asset={asset} className="size-full" onNaturalSize={onNaturalSize} />

      <div className="absolute top-1.5 right-1.5">
        <FavoriteButton isFavorited={isFavorited} onToggle={onToggleFavorite} />
      </div>

      {/* Always visible (not hover-only) — a hover-reveal would leave
       * this unreachable by touch on mobile, where there's no hover
       * state, breaking "giữ nguyên menu thao tác" there. */}
      <div
        className="absolute bottom-1.5 right-1.5 rounded-full bg-background/70 backdrop-blur-sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <AssetActions
          asset={asset}
          canDelete={canDelete}
          isPending={isPending}
          onRequestDelete={onRequestDelete}
          onRequestRename={onRequestRename}
        />
      </div>
    </Link>
  );
}

/** Target row height (px) for the compact grid's justified-row layout, at
 * the same breakpoints the prior h-28..h-44 Tailwind classes used —
 * tracked via window.innerWidth rather than a container query so it
 * keeps matching viewport-based breakpoints, not the (often narrower)
 * content column. */
const COMPACT_HEIGHT_BREAKPOINTS = [
  { minWidth: 1280, height: 176 },
  { minWidth: 1024, height: 160 },
  { minWidth: 768, height: 144 },
  { minWidth: 640, height: 128 },
  { minWidth: 0, height: 112 },
] as const;

function useCompactTargetHeight(): number {
  const [height, setHeight] = useState(112);
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const match = COMPACT_HEIGHT_BREAKPOINTS.find((b) => w >= b.minWidth);
      setHeight(match?.height ?? 112);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return height;
}

/** Live content-box width of a ref'd element, via ResizeObserver — used
 * to know exactly how wide a justified row has to stretch to, since that
 * isn't derivable from a Tailwind breakpoint (the content column itself
 * can be narrower than the viewport). */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const COMPACT_GAP = 4; // matches the row/column gap-1 (0.25rem) below

/** A completed row is stretched so its tiles' combined width exactly
 * fills the container — classic "justified gallery" layout — but never
 * beyond these bounds, so a row of unusually wide or narrow images
 * doesn't balloon or shrink tiles to an awkward size. */
const COMPACT_ROW_STRETCH_MIN = 0.75;
const COMPACT_ROW_STRETCH_MAX = 1.3;

type RatioedAsset = { asset: LibraryAssetListItem; ratio: number };

/** Greedily packs assets into rows at `targetHeight`, closing a row (and
 * stretching it to exactly fill `containerWidth`) as soon as the next
 * asset would overflow it. The trailing remainder that never fills a row
 * is left at `targetHeight`, unstretched — so only a genuinely-partial
 * final row is left-aligned with open space; every earlier row fills the
 * full width. */
function computeJustifiedRows(
  items: RatioedAsset[],
  containerWidth: number,
  targetHeight: number,
  gap: number
): { items: RatioedAsset[]; height: number }[] {
  if (containerWidth <= 0) {
    return items.map((item) => ({ items: [item], height: targetHeight }));
  }

  const rows: { items: RatioedAsset[]; height: number }[] = [];
  let row: RatioedAsset[] = [];
  let ratioSum = 0;

  for (const item of items) {
    row.push(item);
    ratioSum += item.ratio;
    const widthAtTarget = ratioSum * targetHeight + gap * (row.length - 1);
    if (widthAtTarget >= containerWidth) {
      const widthForImages = containerWidth - gap * (row.length - 1);
      const rawHeight = widthForImages / ratioSum;
      const height = Math.min(
        targetHeight * COMPACT_ROW_STRETCH_MAX,
        Math.max(targetHeight * COMPACT_ROW_STRETCH_MIN, rawHeight)
      );
      rows.push({ items: row, height });
      row = [];
      ratioSum = 0;
    }
  }
  if (row.length > 0) rows.push({ items: row, height: targetHeight });

  return rows;
}

/** Dashboard's "Đã tạo gần đây" compact grid — a justified-row layout
 * (the same idea as Google Photos/Flickr) so completed rows stretch to
 * use the full content width instead of leaving a gap when the next
 * tile doesn't fit at the target height. Only the trailing,
 * genuinely-partial row is left unstretched (see computeJustifiedRows). */
function CompactAssetGrid({
  assets,
  canDelete,
  isPending,
  favoriteIds,
  onToggleFavorite,
  onRequestDelete,
  onRequestRename,
}: {
  assets: LibraryAssetListItem[];
  canDelete: (asset: LibraryAssetListItem) => boolean;
  isPending: boolean;
  favoriteIds: Set<string>;
  onToggleFavorite: (asset: LibraryAssetListItem) => void;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
  onRequestRename: (asset: LibraryAssetListItem) => void;
}) {
  const [containerRef, containerWidth] = useMeasuredWidth<HTMLDivElement>();
  const targetHeight = useCompactTargetHeight();
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});

  const items = useMemo<RatioedAsset[]>(
    () =>
      assets.map((asset) => {
        const known = asset.width && asset.height ? asset.width / asset.height : null;
        const raw = known ?? measuredRatios[asset.id] ?? 1;
        return { asset, ratio: Math.min(COMPACT_MAX_RATIO, Math.max(COMPACT_MIN_RATIO, raw)) };
      }),
    [assets, measuredRatios]
  );

  const rows = useMemo(
    () => computeJustifiedRows(items, containerWidth, targetHeight, COMPACT_GAP),
    [items, containerWidth, targetHeight]
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1">
          {row.items.map(({ asset, ratio }) => (
            <CompactGridCard
              key={asset.id}
              asset={asset}
              canDelete={canDelete(asset)}
              isPending={isPending}
              isFavorited={favoriteIds.has(asset.id)}
              onToggleFavorite={() => onToggleFavorite(asset)}
              onRequestDelete={onRequestDelete}
              onRequestRename={onRequestRename}
              ratio={ratio}
              height={row.height}
              onNaturalSize={(width, height) => {
                if (!(asset.width && asset.height)) {
                  setMeasuredRatios((prev) => ({ ...prev, [asset.id]: width / height }));
                }
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListRow({
  asset,
  canDelete,
  isPending,
  onRequestDelete,
  onRequestRename,
}: {
  asset: LibraryAssetListItem;
  canDelete: boolean;
  isPending: boolean;
  onRequestDelete: (asset: LibraryAssetListItem) => void;
  onRequestRename: (asset: LibraryAssetListItem) => void;
}) {
  return (
    <Link
      href={`/library/${asset.id}`}
      className="group flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 outline-none transition-all hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AssetThumb asset={asset} className="size-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p title={asset.name || "Chưa đặt tên"} className="truncate text-sm font-medium">
          {asset.name || "Chưa đặt tên"}
        </p>
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
      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} onPointerDown={(e) => e.stopPropagation()}>
        <AssetActions
          asset={asset}
          canDelete={canDelete}
          isPending={isPending}
          onRequestDelete={onRequestDelete}
          onRequestRename={onRequestRename}
        />
      </div>
    </Link>
  );
}

export function AssetGrid({
  assets,
  currentUserId,
  isAdmin,
  compact = false,
}: {
  assets: LibraryAssetListItem[];
  currentUserId: string;
  isAdmin: boolean;
  /** Thumbnail-only grid cards (CompactGridCard) instead of the full
   * name/brand/type card — used by Dashboard's "Đã tạo gần đây" only.
   * Scoped to GRID mode: list mode (ListRow) is identical either way,
   * and /library's own call site simply never passes this, so its look
   * is completely untouched. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [deleteTarget, setDeleteTarget] = useState<LibraryAssetListItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<LibraryAssetListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [favoriteIds, setFavoriteIds] = useState(
    () => new Set(assets.filter((a) => a.isFavorited).map((a) => a.id))
  );

  if (assets.length === 0) return null;

  function canDelete(asset: LibraryAssetListItem) {
    return isAdmin || asset.ownerId === currentUserId;
  }

  function handleToggleFavorite(asset: LibraryAssetListItem) {
    const next = !favoriteIds.has(asset.id);
    setFavoriteIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(asset.id);
      else copy.delete(asset.id);
      return copy;
    });
    startTransition(async () => {
      const result = await toggleAssetFavorite(asset.id, next);
      if (!result.ok) {
        toast.error(result.error.message);
        // Roll back the optimistic update — the server-side state didn't
        // actually change, so the UI shouldn't claim it did.
        setFavoriteIds((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(asset.id);
          else copy.add(asset.id);
          return copy;
        });
      }
    });
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

  function openRename(asset: LibraryAssetListItem) {
    setRenameTarget(asset);
    setRenameValue(asset.name);
  }

  async function handleConfirmRename() {
    if (!renameTarget) return;
    setIsRenaming(true);
    try {
      const result = await renameAsset(renameTarget.id, renameValue);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã đổi tên.");
      setRenameTarget(null);
      router.refresh();
    } finally {
      setIsRenaming(false);
    }
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
        compact ? (
          <CompactAssetGrid
            assets={assets}
            canDelete={canDelete}
            isPending={isPending}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onRequestDelete={setDeleteTarget}
            onRequestRename={openRename}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {assets.map((asset) => (
              <GridCard
                key={asset.id}
                asset={asset}
                canDelete={canDelete(asset)}
                isPending={isPending}
                onRequestDelete={setDeleteTarget}
                onRequestRename={openRename}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {assets.map((asset) => (
            <ListRow
              key={asset.id}
              asset={asset}
              canDelete={canDelete(asset)}
              isPending={isPending}
              onRequestDelete={setDeleteTarget}
              onRequestRename={openRename}
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

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên tài sản</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Tên tài sản"
            maxLength={200}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConfirmRename();
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isRenaming} onClick={() => setRenameTarget(null)}>
              Huỷ
            </Button>
            <Button type="button" disabled={isRenaming} onClick={handleConfirmRename}>
              {isRenaming ? <Loader2 className="size-4 animate-spin" /> : null}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
