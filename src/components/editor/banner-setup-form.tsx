"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandPicker } from "@/components/brand/brand-picker";
import { createBannerAsset, getBrandTemplatesAction, getBrandImageAssetsAction } from "@/lib/design/actions";
import { uploadImageAsset } from "@/lib/generation/actions";
import type { Brand, SizePreset, Template } from "@/types/brand";

interface ImageOption {
  id: string;
  name: string;
  url: string | null;
}

export function BannerSetupForm({
  brands,
  presets,
  initialBackgroundAssetId,
}: {
  brands: Brand[];
  presets: SizePreset[];
  initialBackgroundAssetId: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [brandId, setBrandId] = useState<string | null>(brands[0]?.id ?? null);
  const [sizePresetId, setSizePresetId] = useState<string>(presets[0]?.id ?? "");
  const [templateId, setTemplateId] = useState<string>("");
  const [backgroundAssetId, setBackgroundAssetId] = useState<string | null>(initialBackgroundAssetId);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [images, setImages] = useState<ImageOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!brandId) return;
    getBrandTemplatesAction(brandId).then(setTemplates);
    getBrandImageAssetsAction(brandId).then((assets) => setImages(assets.map((a) => ({ id: a.id, name: a.name, url: a.url }))));
  }, [brandId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !brandId) return;
    setUploading(true);
    try {
      const result = await uploadImageAsset(brandId, file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setBackgroundAssetId(result.data.assetId);
      const assets = await getBrandImageAssetsAction(brandId);
      setImages(assets.map((a) => ({ id: a.id, name: a.name, url: a.url })));
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || !brandId || !sizePresetId) return;
    startTransition(async () => {
      const result = await createBannerAsset({
        brandId,
        sizePresetId,
        backgroundAssetId,
        templateId: templateId || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.push(`/create/banner/${result.data.assetId}`);
    });
  }

  if (brands.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Chưa có thương hiệu nào sẵn sàng. Liên hệ Admin của workspace để tạo thương hiệu trước.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Thương hiệu</Label>
              <BrandPicker brands={brands} value={brandId} onChange={setBrandId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Kích thước</Label>
              <Select value={sizePresetId} onValueChange={(v) => v && setSizePresetId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.width}×{p.height})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5">
                <LayoutTemplate className="size-3.5" />
                Mẫu (tuỳ chọn)
              </Label>
              <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Không dùng mẫu" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Ảnh nền</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {images.map((img) => (
                <button
                  type="button"
                  key={img.id}
                  onClick={() => setBackgroundAssetId(img.id)}
                  className={`aspect-square rounded-md border-2 overflow-hidden bg-muted/40 ${
                    backgroundAssetId === img.id ? "border-primary" : "border-transparent"
                  }`}
                >
                  {img.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={img.url} alt={img.name} className="size-full object-cover" />
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || !brandId}
                className="aspect-square rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover:bg-muted/40"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              </button>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} className="hidden" />
            </div>
            <p className="text-xs text-muted-foreground">
              Chọn ảnh có sẵn, tải ảnh lên, hoặc bỏ qua để bắt đầu với nền trống.
            </p>
          </div>

          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Mở trình chỉnh sửa
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
