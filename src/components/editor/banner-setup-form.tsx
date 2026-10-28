"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Eye, Loader2, Upload, LayoutTemplate, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandPicker } from "@/components/brand/brand-picker";
import { SizePresetPicker } from "@/components/brand/size-preset-picker";
import { ModelPicker } from "@/components/generate/model-picker";
import { progressLabel } from "@/components/generate/job-status";
import { CharCounter } from "@/components/generate/char-counter";
import { cn } from "@/lib/utils";
import { createBannerAsset, getBrandTemplatesAction, getBrandImageAssetsAction } from "@/lib/design/actions";
import { uploadImageAsset, generateImages, getGenerationJobAction, saveGenerationResult } from "@/lib/generation/actions";
import { AUTO_MODEL_ID, effectiveMaxPromptLength, type ModelMeta } from "@/lib/generation/model-meta";
import { findHiggsfieldSize } from "@/lib/generation/providers/higgsfield-sizes";
import type { Brand, SizePreset, Template } from "@/types/brand";
import type { GenerationJob } from "@/types/generation";

interface ImageOption {
  id: string;
  name: string;
  url: string | null;
}

const AI_POLL_INTERVAL_MS = 1_500;
const AI_POLL_MAX_ATTEMPTS = 100; // ~150s — covers the fallback chain's own internal timeouts with margin
const HIGGSFIELD_MODEL_ID = "higgsfield-soul2";
// The AI background is always generated SQUARE (1:1) regardless of the
// banner's chosen size preset — it's the shared "master" image that every
// banner size later reuses (only its crop/position changes per size, in
// the editor's own resize step). 1536 is a confirmed valid Higgsfield
// Soul width_and_height value (see higgsfield-sizes.ts) and a safe
// square pixel size for every other provider's exactSize.
const MASTER_BACKGROUND_PX = 1536;

function StepHeader({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {step}
        </span>
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );
}

export function BannerSetupForm({
  brands,
  presets,
  initialBackgroundAssetId,
  models,
}: {
  brands: Brand[];
  presets: SizePreset[];
  initialBackgroundAssetId: string | null;
  /** Server-resolved CONFIGURED models only — see listAvailableModels(). */
  models: ModelMeta[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [brandId, setBrandId] = useState<string | null>(brands[0]?.id ?? null);
  const [sizePresetId, setSizePresetId] = useState<string>(presets[0]?.id ?? "");
  const [templateId, setTemplateId] = useState<string>("");
  const [backgroundAssetId, setBackgroundAssetId] = useState<string | null>(initialBackgroundAssetId);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [images, setImages] = useState<ImageOption[]>([]);
  const [imagesLoadedForBrand, setImagesLoadedForBrand] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState<string>(AUTO_MODEL_ID);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiJob, setAiJob] = useState<GenerationJob | null>(null);
  const isAiHiggsfield = aiModel === HIGGSFIELD_MODEL_ID;

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    getBrandTemplatesAction(brandId).then((t) => {
      if (!cancelled) setTemplates(t);
    });
    getBrandImageAssetsAction(brandId).then((assets) => {
      if (cancelled) return;
      const opts = assets.map((a) => ({ id: a.id, name: a.name, url: a.url }));
      setImages(opts);
      setImagesLoadedForBrand(brandId);
      // A background picked for a PREVIOUS brand doesn't belong to this
      // one — never carry it forward silently (only ever clear a
      // selection that's actually gone, never one still present).
      setBackgroundAssetId((current) => (current && !opts.some((o) => o.id === current) ? null : current));
    });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const imagesLoading = brandId !== null && imagesLoadedForBrand !== brandId;

  async function refreshImages() {
    if (!brandId) return;
    const assets = await getBrandImageAssetsAction(brandId);
    setImages(assets.map((a) => ({ id: a.id, name: a.name, url: a.url })));
  }

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
      await refreshImages();
    } finally {
      setUploading(false);
    }
  }

  const aiMaxPromptLength = effectiveMaxPromptLength(aiModel, models);
  const aiPromptOverLimit = aiPrompt.length > aiMaxPromptLength;
  const selectedPreset = presets.find((p) => p.id === sizePresetId);
  const selectedBrand = brands.find((b) => b.id === brandId);

  /** Mirrors handleUpload's shape — just sourced from AI generation
   * instead of a file input. Reuses the SAME generateImages/fallback
   * orchestrator as "Tạo ảnh" (count fixed at 1, polled inline here since
   * this step has no job-detail page of its own), then immediately saves
   * the result into the library exactly like an uploaded file would be,
   * and selects it as the background. Always requests a SQUARE master —
   * see MASTER_BACKGROUND_PX above — never the banner's own size preset,
   * so the exact same source image can be reused (re-cropped, never
   * re-generated) by every size the user picks later in the editor. */
  async function handleGenerateBackground() {
    if (!brandId || !aiPrompt.trim() || aiGenerating || aiPromptOverLimit) return;
    setAiGenerating(true);
    setAiJob(null);
    try {
      const higgsfieldSquare = findHiggsfieldSize("1536x1536");
      const sizeFields =
        isAiHiggsfield && higgsfieldSquare
          ? { exactSize: { width: higgsfieldSquare.width, height: higgsfieldSquare.height } }
          : { exactSize: { width: MASTER_BACKGROUND_PX, height: MASTER_BACKGROUND_PX } };
      const result = await generateImages({
        brandId,
        ...sizeFields,
        prompt: aiPrompt,
        negativePrompt: "",
        count: 1,
        model: aiModel,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      let job: GenerationJob | null = null;
      for (let i = 0; i < AI_POLL_MAX_ATTEMPTS; i++) {
        job = await getGenerationJobAction(result.data.jobId);
        if (job && (job.status === "succeeded" || job.status === "failed")) break;
        setAiJob(job);
        await new Promise((resolve) => setTimeout(resolve, AI_POLL_INTERVAL_MS));
      }
      setAiJob(job);

      if (!job || job.status !== "succeeded") {
        toast.error(job?.error || "Không thể tạo ảnh nền lúc này. Vui lòng thử lại.");
        return;
      }

      const saved = await saveGenerationResult({ jobId: job.id, outputIndex: 0, name: aiPrompt.slice(0, 80) });
      if (!saved.ok) {
        toast.error(saved.error.message);
        return;
      }
      setBackgroundAssetId(saved.data.assetId);
      await refreshImages();
      toast.success("Đã tạo ảnh nền và chọn làm background.");
    } finally {
      setAiGenerating(false);
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

  const canContinue = !isPending && !!brandId && !!sizePresetId;
  const missingReason = !brandId ? "Chọn thương hiệu để tiếp tục." : !sizePresetId ? "Chọn kích thước để tiếp tục." : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Step 1 — Setup */}
      <Card>
        <StepHeader
          step={1}
          title="Thiết lập banner"
          description={
            selectedBrand && selectedPreset
              ? `${selectedBrand.name} · ${selectedPreset.name} (${selectedPreset.width} × ${selectedPreset.height} px)`
              : "Chọn thương hiệu và kích thước banner"
          }
        />
        <CardContent className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Thương hiệu</Label>
              <BrandPicker brands={brands} value={brandId} onChange={setBrandId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Kích thước</Label>
              <SizePresetPicker presets={presets} value={sizePresetId} onChange={setSizePresetId} />
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
                  <SelectValue placeholder="Không dùng mẫu">
                    {() => {
                      const selected = templates.find((t) => t.id === templateId);
                      return selected ? <span className="truncate">{selected.name}</span> : "Không dùng mẫu";
                    }}
                  </SelectValue>
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
        </CardContent>
      </Card>

      {/* Step 2 — Background */}
      <Card>
        <StepHeader
          step={2}
          title="Chọn background"
          description="Chọn ảnh có sẵn của thương hiệu, tải ảnh lên, hoặc tạo bằng AI — có thể bỏ qua để bắt đầu với nền trống."
        />
        <CardContent className="flex flex-col gap-4">
          {imagesLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {images.map((img) => {
                const selected = backgroundAssetId === img.id;
                return (
                  <div key={img.id} className="group relative flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setBackgroundAssetId(img.id)}
                      aria-pressed={selected}
                      aria-label={img.name || "Ảnh nền chưa đặt tên"}
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-lg bg-muted/40 outline-none ring-2 transition-all",
                        selected
                          ? "ring-primary"
                          : "ring-transparent hover:ring-border focus-visible:ring-primary"
                      )}
                    >
                      {img.url && (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                        <img src={img.url} alt="" className="size-full object-cover" />
                      )}
                      {selected && (
                        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <CheckCircle2 className="size-3.5" />
                        </span>
                      )}
                    </button>
                    {img.url && (
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(img.url)}
                        aria-label={`Xem lớn ${img.name || "ảnh nền"}`}
                        className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                      >
                        <Eye className="size-3" />
                      </button>
                    )}
                    <span className="truncate text-[11px] text-muted-foreground">{img.name || "Chưa đặt tên"}</span>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || !brandId}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                <span className="px-1 text-center text-[11px] font-medium leading-tight">
                  {uploading ? "Đang tải lên..." : "Tải ảnh nền lên"}
                </span>
              </button>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} className="hidden" />
            </div>
          )}

          {!imagesLoading && images.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Thương hiệu này chưa có ảnh nào trong thư viện — tải ảnh lên hoặc tạo bằng AI bên dưới.
            </p>
          )}

          {/* AI background — collapsed by default so it doesn't crowd the library above. */}
          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => setAiPanelOpen((v) => !v)}
              aria-expanded={aiPanelOpen}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-3.5 text-primary" />
                Tạo ảnh nền bằng AI
              </span>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", aiPanelOpen && "rotate-180")} />
            </button>
            {aiPanelOpen && (
              <div className="flex flex-col gap-2 border-t p-3">
                <p className="text-xs text-muted-foreground">
                  Ảnh nền AI luôn được tạo dạng vuông (1:1) làm ảnh gốc dùng chung cho mọi kích thước banner — bạn có
                  thể đổi kích thước và vị trí hiển thị của ảnh sau, trong trình chỉnh sửa, mà không cần tạo lại ảnh.
                </p>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Mô tả ảnh nền muốn tạo, ví dụ: nền trừu tượng màu xanh dương, phong cách tối giản..."
                  rows={2}
                  maxLength={aiMaxPromptLength}
                  aria-invalid={aiPromptOverLimit}
                  disabled={aiGenerating}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {aiPromptOverLimit
                      ? `Mô tả đang vượt giới hạn của model đã chọn — rút ngắn còn tối đa ${aiMaxPromptLength.toLocaleString("vi-VN")} ký tự.`
                      : " "}
                  </p>
                  <CharCounter current={aiPrompt.length} max={aiMaxPromptLength} />
                </div>
                <ModelPicker models={models} value={aiModel} onChange={setAiModel} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={aiGenerating || !aiPrompt.trim() || !brandId || aiPromptOverLimit}
                  onClick={handleGenerateBackground}
                  className="w-fit"
                >
                  {aiGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Tạo ảnh nền
                </Button>
                {aiGenerating && aiJob && progressLabel(aiJob) && (
                  <p className="text-xs text-muted-foreground">{progressLabel(aiJob)}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3 — Continue */}
      <div className="flex flex-col items-start gap-1.5">
        <Button type="submit" disabled={!canContinue} size="lg">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Tiếp tục chỉnh sửa banner
        </Button>
        {missingReason && <p className="text-xs text-muted-foreground">{missingReason}</p>}
      </div>

      <Dialog open={previewUrl !== null} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl p-2">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, preview-only
            <img src={previewUrl} alt="Xem trước ảnh nền" className="max-h-[75vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}
