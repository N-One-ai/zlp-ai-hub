"use client";

import { useState } from "react";
import { Image as ImageIcon, Copy, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { DownloadAssetButton } from "@/components/library/download-asset-button";
import { modelLabel } from "@/lib/generation/model-meta";
import type { GeneratedImageGalleryItem } from "@/lib/generation/queries";

/** Gallery of every real (non-demo, actually generated and auto-saved)
 * image for this workspace, newest first — the Tạo ảnh page's own
 * "thư viện dạng grid", separate from the full Thư viện page (which
 * lists every asset type, not just this page's generations). Real data
 * only: an item only ever appears here once generateImages() has
 * actually succeeded and the result was saved as a creative_asset —
 * never a placeholder standing in for a result. */
export function GeneratedImageGallery({
  items,
  onCreateVariant,
}: {
  items: GeneratedImageGalleryItem[];
  onCreateVariant: (item: GeneratedImageGalleryItem) => void;
}) {
  const [openItem, setOpenItem] = useState<GeneratedImageGalleryItem | null>(null);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="Chưa có ảnh nào"
        description="Nhập mô tả ở composer phía trên rồi bấm Tạo ảnh — ảnh tạo ra sẽ xuất hiện ở đây."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.id} className="group relative flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setOpenItem(item)}
              className="relative aspect-square w-full overflow-hidden rounded-xl ring-1 ring-border bg-muted/30 hover:ring-primary/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={item.thumbnailUrl} alt={item.prompt ?? "Ảnh đã tạo"} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="size-5" />
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all group-hover:bg-background/40 group-hover:opacity-100">
                <Maximize2 className="size-5 text-foreground" />
              </span>
            </button>
            {item.prompt && <p className="line-clamp-1 text-xs text-muted-foreground">{item.prompt}</p>}
          </div>
        ))}
      </div>

      <Dialog open={openItem !== null} onOpenChange={(open) => !open && setOpenItem(null)}>
        <DialogContent className="sm:max-w-2xl">
          {openItem && (
            <>
              <DialogTitle className="sr-only">{openItem.prompt ?? "Ảnh đã tạo"}</DialogTitle>
              <DialogDescription className="sr-only">Xem lớn ảnh đã tạo</DialogDescription>
              <div className="overflow-hidden rounded-lg bg-muted/30">
                {openItem.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={openItem.thumbnailUrl} alt={openItem.prompt ?? "Ảnh đã tạo"} className="max-h-[70vh] w-full object-contain" />
                )}
              </div>
              {openItem.prompt && <p className="text-sm text-muted-foreground">{openItem.prompt}</p>}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {openItem.width && openItem.height ? `${openItem.width}×${openItem.height}px` : null}
                  {openItem.finalModel && ` · ${modelLabel(openItem.finalModel)}`}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onCreateVariant(openItem);
                      setOpenItem(null);
                    }}
                  >
                    <Copy className="size-3.5" />
                    Tạo biến thể
                  </Button>
                  {openItem.thumbnailUrl && (
                    <DownloadAssetButton assetId={openItem.id} assetType="image" url={openItem.thumbnailUrl} />
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
