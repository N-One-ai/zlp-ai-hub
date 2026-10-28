"use client";

import { useRef, useState } from "react";
import { Paperclip, AtSign, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { uploadReferenceImage, resolveAssetAsReference } from "@/lib/generation/actions";
import type { LibraryAssetListItem } from "@/types/library";

export interface ReferenceImage {
  url: string;
  label: string;
}

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * "Reference" (upload a file) and "@ Elements" (pick an existing image
 * from the workspace's library) are two entry points into the SAME slot
 * list, capped at `max` — Higgsfield Soul only ever accepts one
 * image_reference per request (confirmed live, see higgsfield-provider.ts)
 * so callers pass max=1 there; Marketing Studio accepts up to 2 (product
 * image + optional model/style reference, confirmed live — a 3rd URL is
 * rejected by the real API, see marketing-studio-provider.ts). When
 * max === 1, picking a new image REPLACES the existing one (single-slot
 * behavior, same as before); when max > 1, it's appended until full.
 */
export function ReferencePicker({
  values,
  onChange,
  elements,
  max = 1,
  disabled,
  disabledReason,
}: {
  values: ReferenceImage[];
  onChange: (values: ReferenceImage[]) => void;
  /** Recent image assets from the workspace, for "@ Elements". */
  elements: LibraryAssetListItem[];
  /** How many reference images the selected model accepts at once —
   * mirrors that model's capabilities.maxReferenceImages. */
  max?: number;
  /** True when the selected model doesn't support a reference image at
   * all (max === 0) — both controls are disabled and explain why, never
   * silently dropped without the user knowing (no fake-looking enabled
   * button). */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [elementsOpen, setElementsOpen] = useState(false);
  const full = values.length >= max;

  function addOrReplace(image: ReferenceImage) {
    onChange(max <= 1 ? [image] : [...values, image].slice(0, max));
  }
  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > UPLOAD_MAX_BYTES) {
      toast.error("File quá lớn. Tối đa 10MB.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadReferenceImage(file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      addOrReplace({ url: result.data.url, label: file.name });
    } finally {
      setUploading(false);
    }
  }

  async function handlePickElement(asset: LibraryAssetListItem) {
    setElementsOpen(false);
    const result = await resolveAssetAsReference(asset.id);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    addOrReplace({ url: result.data.url, label: asset.name || "Tài sản" });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" title={disabled ? disabledReason : undefined}>
      {values.map((value, index) => (
        <div key={value.url} className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 py-1 pr-1 pl-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img src={value.url} alt={value.label} className="size-6 rounded object-cover" />
          <span className="max-w-32 truncate text-xs text-muted-foreground">
            {max > 1 ? (index === 0 ? "Sản phẩm: " : "Mẫu: ") : ""}
            {value.label}
          </span>
          <Button type="button" size="icon-xs" variant="ghost" onClick={() => removeAt(index)} aria-label="Bỏ ảnh tham chiếu">
            <X className="size-3" />
          </Button>
        </div>
      ))}

      {!full && (
        <>
          <Button type="button" size="sm" variant="outline" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
            Reference
          </Button>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />

          <Popover open={elementsOpen} onOpenChange={setElementsOpen}>
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant="outline" disabled={disabled || elements.length === 0}>
                  <AtSign className="size-3.5" />
                  Elements
                </Button>
              }
            />
            <PopoverContent align="start" className="w-64 p-1.5">
              <p className="px-1.5 py-1 text-xs text-muted-foreground">Chọn ảnh có sẵn làm tham chiếu</p>
              <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                {elements.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handlePickElement(asset)}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {asset.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                        <img src={asset.thumbnailUrl} alt={asset.name} className="size-full object-cover" />
                      )}
                    </span>
                    <span className="truncate">{asset.name || "Chưa đặt tên"}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
