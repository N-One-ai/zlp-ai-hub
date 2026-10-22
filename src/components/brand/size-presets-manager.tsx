"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSizePreset, deleteSizePreset } from "@/lib/brand/actions";
import type { SizePreset } from "@/types/brand";

export function SizePresetsManager({ workspaceId, presets }: { workspaceId: string; presets: SizePreset[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [width, setWidth] = useState("1080");
  const [height, setHeight] = useState("1080");
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    startTransition(async () => {
      const result = await createSizePreset(workspaceId, {
        name,
        channel,
        width: Number(width),
        height: Number(height),
        exportFormat: format,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setName("");
      setChannel("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSizePreset(id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y">
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.channel ? `${p.channel} · ` : ""}
                {p.width}×{p.height}px · {p.exportFormat.toUpperCase()}
              </p>
            </div>
            <Button size="icon-sm" variant="ghost" disabled={isPending} onClick={() => handleDelete(p.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {presets.length === 0 && <p className="py-4 text-sm text-muted-foreground">Chưa có preset kích thước.</p>}
      </div>

      <form onSubmit={handleCreate} className="grid sm:grid-cols-5 gap-2 items-end">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs">Tên preset</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Instagram Post" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Kênh</Label>
          <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Instagram" />
        </div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 flex-1">
            <Label className="text-xs">W</Label>
            <Input type="number" min={1} value={width} onChange={(e) => setWidth(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <Label className="text-xs">H</Label>
            <Input type="number" min={1} value={height} onChange={(e) => setHeight(e.target.value)} required />
          </div>
        </div>
        <div className="flex gap-1">
          <Select value={format} onValueChange={(v) => setFormat(v as "png" | "jpg")}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="jpg">JPG</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="icon" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
