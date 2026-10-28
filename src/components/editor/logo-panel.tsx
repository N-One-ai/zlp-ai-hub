"use client";

import { cn } from "@/lib/utils";
import type { GuidelineLogos } from "@/types/brand";

/**
 * "Logo thương hiệu" — lets the user pick which of the brand guideline's
 * two logo variants sits on the canvas: the full-color logo (`primary`)
 * or the white/light variant meant for dark backgrounds (`dark` — the
 * guideline only has primary/secondary/light/dark slots, no slot
 * literally named "white"; `dark` is the one semantically meant to be
 * placed ON a dark background, which in practice is the white/monochrome
 * version — see README). A variant that hasn't been uploaded shows a
 * disabled tile with guidance instead of silently falling back to a
 * different logo or a placeholder image.
 */
export function LogoPanel({
  logos,
  activePath,
  onSelect,
}: {
  logos: GuidelineLogos;
  /** The currently placed logo layer's imagePath, if any — used only to
   * highlight which variant is active; absent when there's no logo layer
   * yet. */
  activePath: string | null | undefined;
  onSelect: (variant: "color" | "white", path: string, url: string) => void;
}) {
  const variants: { key: "color" | "white"; label: string; path: string | null; url: string | null }[] = [
    { key: "color", label: "Logo màu", path: logos.primaryPath, url: logos.primaryUrl },
    { key: "white", label: "Logo trắng", path: logos.darkPath, url: logos.darkUrl },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {variants.map((v) => {
        const available = Boolean(v.path && v.url);
        const active = available && v.path === activePath;
        return (
          <button
            key={v.key}
            type="button"
            disabled={!available}
            onClick={() => available && v.path && v.url && onSelect(v.key, v.path, v.url)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors",
              !available && "cursor-not-allowed opacity-60",
              active ? "border-primary bg-primary/10" : "border-input hover:border-foreground/30"
            )}
          >
            <span
              className={cn(
                "flex h-12 w-full items-center justify-center rounded-md",
                v.key === "white" ? "bg-neutral-800" : "bg-muted/40"
              )}
            >
              {available ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={v.url!} alt={v.label} className="max-h-10 max-w-[90%] object-contain" />
              ) : (
                <span className="text-[10px] text-muted-foreground">Chưa có</span>
              )}
            </span>
            <span className="text-xs font-medium">{v.label}</span>
          </button>
        );
      })}
      {!(logos.primaryUrl && logos.darkUrl) && (
        <p className="col-span-2 text-xs text-muted-foreground">
          {!logos.primaryUrl && !logos.darkUrl
            ? "Thương hiệu chưa có Logo chính lẫn Biến thể nền tối."
            : !logos.primaryUrl
              ? "Thương hiệu chưa có Logo chính (dùng làm \"Logo màu\")."
              : "Thương hiệu chưa có Biến thể nền tối (dùng làm \"Logo trắng\")."}{" "}
          Tải lên ở trang Thương hiệu → Guideline.
        </p>
      )}
    </div>
  );
}
