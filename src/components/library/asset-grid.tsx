import Link from "next/link";
import { Image as ImageIcon, LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LibraryAssetListItem } from "@/types/library";

const STATUS_LABEL = { draft: "Nháp", ready: "Hoàn tất", archived: "Lưu trữ" } as const;

export function AssetGrid({ assets }: { assets: LibraryAssetListItem[] }) {
  if (assets.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {assets.map((asset) => (
        <Link
          key={asset.id}
          href={`/library/${asset.id}`}
          className="flex flex-col gap-2 rounded-lg border overflow-hidden hover:border-foreground/30 transition-colors"
        >
          <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
            {asset.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
              <img src={asset.thumbnailUrl} alt={asset.name} className="size-full object-cover" />
            ) : asset.type === "banner" ? (
              <LayoutTemplate className="size-6 text-muted-foreground" />
            ) : (
              <ImageIcon className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-1 px-2 pb-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium truncate">{asset.name || "Chưa đặt tên"}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {STATUS_LABEL[asset.status]}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground truncate">{asset.brandName}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
