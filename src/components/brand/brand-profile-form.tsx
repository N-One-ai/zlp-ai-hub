"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateBrand, uploadBrandAvatar, archiveBrand } from "@/lib/brand/actions";
import { BRAND_LOGO_ALLOWED_TYPES } from "@/lib/brand/storage";
import type { Brand } from "@/types/brand";

export function BrandProfileForm({
  workspaceId,
  brand,
  avatarUrl,
}: {
  workspaceId: string;
  brand: Brand;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description);
  const [preview, setPreview] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadBrandAvatar(workspaceId, brand.id, file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setPreview(result.data.previewUrl);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    startTransition(async () => {
      const result = await updateBrand(brand.id, { name, description });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã lưu.");
      router.refresh();
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveBrand(brand.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã lưu trữ thương hiệu.");
      router.push("/brands");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {preview && <AvatarImage src={preview} alt={brand.name} />}
          <AvatarFallback className="text-lg">{brand.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Đổi ảnh đại diện
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={BRAND_LOGO_ALLOWED_TYPES.join(",")}
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-brand-name">Tên thương hiệu</Label>
          <Input id="edit-brand-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-brand-description">Mô tả</Label>
          <Textarea
            id="edit-brand-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu
          </Button>
          {brand.status === "active" && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleArchive}>
              Lưu trữ thương hiệu
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
