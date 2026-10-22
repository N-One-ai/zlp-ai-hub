"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadBrandLogo, discardBrandAsset, type LogoVariant } from "@/lib/brand/actions";
import { BRAND_LOGO_ALLOWED_TYPES } from "@/lib/brand/storage";

export interface LogoFieldValue {
  path: string | null;
  previewUrl: string | null;
  /** True only for a file uploaded in THIS editing session, not yet saved
   * into a guideline version — only these are safe to delete from Storage
   * outright when removed, since a saved version's logo may still be
   * referenced by that version's history (PRD principle: never lose
   * data). Removing an already-saved logo just clears it for the NEW
   * version being built; the old file stays in Storage untouched. */
  isNew: boolean;
}

export const EMPTY_LOGO_FIELD: LogoFieldValue = { path: null, previewUrl: null, isNew: false };

const VARIANT_LABEL: Record<LogoVariant, string> = {
  primary: "Logo chính",
  secondary: "Logo phụ",
  light: "Biến thể nền sáng",
  dark: "Biến thể nền tối",
};

export function LogoUploader({
  workspaceId,
  brandId,
  variant,
  value,
  onChange,
}: {
  workspaceId: string;
  brandId: string;
  variant: LogoVariant;
  value: LogoFieldValue;
  onChange: (next: LogoFieldValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadBrandLogo(workspaceId, brandId, variant, file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      onChange({ path: result.data.path, previewUrl: result.data.previewUrl, isNew: true });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (value.isNew && value.path) {
      await discardBrandAsset(value.path);
    }
    onChange({ ...EMPTY_LOGO_FIELD });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{VARIANT_LABEL[variant]}</span>
      <div className="flex items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-lg border bg-muted/40 shrink-0 overflow-hidden">
          {value.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset Next/Image should optimize/cache
            <img src={value.previewUrl} alt={VARIANT_LABEL[variant]} className="size-full object-contain p-1.5" />
          ) : (
            <Upload className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading && <Loader2 className="size-3.5 animate-spin" />}
            {value.previewUrl ? "Thay đổi" : "Tải lên"}
          </Button>
          {value.previewUrl && (
            <Button type="button" size="sm" variant="ghost" onClick={handleRemove}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={BRAND_LOGO_ALLOWED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
