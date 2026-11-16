"use client";

import { useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ElementAsset {
  id: string;
  name: string;
  path: string;
  width: number | null;
  height: number | null;
  url: string | null;
}

/**
 * "Elements" — decorative stickers/shapes the user picks from the
 * brand's own library (reusing the same creative_assets upload pipeline
 * as background images, tagged "element" — see
 * lib/design/queries.ts#getBrandElementAssets) or uploads fresh. Clicking
 * a thumbnail adds it as a brand-new layer (see editor-shell.tsx);
 * uploading only adds to this library grid, it does not place anything
 * on the canvas by itself, so a batch upload never surprises the user
 * with elements suddenly appearing on their banner.
 *
 * Thumbnails sit on a checkerboard backdrop so a transparent PNG/WebP's
 * real edges are visible against the picker's own background, not just
 * against the page's.
 */
export function ElementsPanel({
  elements,
  loading,
  uploading,
  onSelect,
  onUpload,
}: {
  elements: ElementAsset[];
  loading: boolean;
  uploading: boolean;
  onSelect: (element: ElementAsset) => void;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-2">
          <Loader2 className="size-3.5 animate-spin" />
          Đang tải thư viện elements...
        </p>
      ) : elements.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">
          Chưa có hình trang trí nào trong thư viện của thương hiệu này — tải lên để bắt đầu.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {elements.map((el) => (
            <button
              key={el.id}
              type="button"
              title={el.name}
              onClick={() => onSelect(el)}
              className={cn(
                "aspect-square rounded-md border bg-[length:10px_10px] bg-[image:repeating-conic-gradient(#e7e5e4_0%_25%,transparent_0%_50%)]",
                "flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/50 transition-shadow"
              )}
            >
              {el.url && (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={el.url} alt={el.name} className="max-h-full max-w-full object-contain" />
              )}
            </button>
          ))}
        </div>
      )}

      <label
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs cursor-pointer hover:bg-accent/50",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {uploading ? "Đang tải lên..." : "Tải hình trang trí lên"}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground px-1">
        PNG, JPG hoặc WEBP, tối đa 10MB. Nên dùng PNG/WebP nền trong suốt để hiển thị đẹp trên mọi nền.
      </p>
    </div>
  );
}
