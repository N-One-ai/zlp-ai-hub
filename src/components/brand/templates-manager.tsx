"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Archive } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTemplate, archiveTemplate } from "@/lib/brand/actions";
import type { SizePreset, Template } from "@/types/brand";

export function TemplatesManager({
  brandId,
  templates,
  presets,
}: {
  brandId: string;
  templates: Template[];
  presets: SizePreset[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sizePresetId, setSizePresetId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    startTransition(async () => {
      const result = await createTemplate(brandId, {
        name,
        sizePresetId: sizePresetId || null,
        layout: {},
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveTemplate(id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Mẫu chỉ lưu tên và kích thước ở bước này — bố cục layer (logo/chữ) sẽ được chỉnh trong Trình chỉnh sửa banner
        (Task 4.0).
      </p>
      <div className="flex flex-col divide-y">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {presets.find((p) => p.id === t.sizePresetId)?.name ?? "Chưa gắn preset"}
              </p>
            </div>
            <Button size="icon-sm" variant="ghost" disabled={isPending} onClick={() => handleArchive(t.id)}>
              <Archive className="size-3.5" />
            </Button>
          </div>
        ))}
        {templates.length === 0 && <p className="py-4 text-sm text-muted-foreground">Chưa có mẫu banner.</p>}
      </div>

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex flex-col gap-1 flex-1">
          <Label className="text-xs">Tên mẫu</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mẫu chuẩn" required />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <Label className="text-xs">Preset kích thước</Label>
          <Select value={sizePresetId} onValueChange={(v) => setSizePresetId(v ?? "")}>
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
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Tạo mẫu
        </Button>
      </form>
    </div>
  );
}
