"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { BrandPicker } from "@/components/brand/brand-picker";
import { JobStatus } from "./job-status";
import { ImageUploadCard } from "./image-upload-card";
import { generateImages, getGenerationJobAction } from "@/lib/generation/actions";
import type { Brand, SizePreset } from "@/types/brand";
import type { GenerationJob } from "@/types/generation";

export function ImageGenerateForm({
  brands,
  presets,
  brandColors,
  initialJob,
}: {
  brands: Brand[];
  presets: SizePreset[];
  brandColors: Record<string, string[]>;
  /** Hydrated from the ?job= URL param server-side (page.tsx) — this is
   * what makes job status survive a full page refresh (PRD §12: "trạng
   * thái job bền vững qua refresh"), not just client-side React state. */
  initialJob: GenerationJob | null;
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState<string | null>(initialJob?.brandId ?? brands[0]?.id ?? null);
  const [sizePresetId, setSizePresetId] = useState<string>(presets[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [count, setCount] = useState("1");
  const [job, setJob] = useState<GenerationJob | null>(initialJob);
  const [isPending, startTransition] = useTransition();

  const selectedPreset = presets.find((p) => p.id === sizePresetId);
  const colors = brandId ? (brandColors[brandId] ?? []) : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || !brandId || !sizePresetId) return;

    startTransition(async () => {
      const result = await generateImages({
        brandId,
        prompt,
        negativePrompt,
        sizePresetId,
        count: Number(count),
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const newJob = await getGenerationJobAction(result.data.jobId);
      if (newJob) setJob(newJob);
      router.replace(`/create/image?job=${result.data.jobId}`, { scroll: false });
    });
  }

  if (brands.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Chưa có thương hiệu nào sẵn sàng. Liên hệ Admin của workspace để tạo thương hiệu và cấu hình guideline
            trước.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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

            {colors.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Bảng màu thương hiệu:</span>
                {colors.map((hex) => (
                  <span key={hex} className="size-4 rounded-full border" style={{ backgroundColor: hex }} title={hex} />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt">Mô tả ảnh</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ví dụ: ảnh sản phẩm trên nền sáng, phong cách tối giản..."
                rows={3}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="negative-prompt">Loại trừ (tuỳ chọn)</Label>
              <Textarea
                id="negative-prompt"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Những gì không muốn xuất hiện trong ảnh..."
                rows={2}
              />
            </div>

            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Số lượng</Label>
                <Select value={count} onValueChange={(v) => v && setCount(v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isPending || !sizePresetId}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Tạo ảnh
              </Button>
            </div>

            {selectedPreset && (
              <p className="text-xs text-muted-foreground">
                Xuất ra {selectedPreset.width}×{selectedPreset.height}px ({selectedPreset.exportFormat.toUpperCase()})
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {job && <JobStatus initialJob={job} />}

      <ImageUploadCard brandId={brandId} />
    </div>
  );
}
