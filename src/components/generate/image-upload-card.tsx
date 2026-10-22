"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadImageAsset } from "@/lib/generation/actions";

export function ImageUploadCard({ brandId }: { brandId: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      toast.success("Đã tải lên và lưu vào thư viện.");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Hoặc tải ảnh lên</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading || !brandId}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Chọn ảnh (PNG, JPG, WEBP — tối đa 10MB)
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        {!brandId && <p className="mt-1.5 text-xs text-muted-foreground">Chọn thương hiệu trước khi tải ảnh lên.</p>}
      </CardContent>
    </Card>
  );
}
