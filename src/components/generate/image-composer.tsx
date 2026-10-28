"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SizePresetPicker } from "@/components/brand/size-preset-picker";
import { HiggsfieldSizePicker } from "@/components/brand/higgsfield-size-picker";
import {
  AspectRatioPicker,
  ResolutionPicker,
  type MarketingStudioAspectRatio,
  type MarketingStudioResolution,
} from "./aspect-ratio-picker";
import { EnhancePresetPicker } from "./enhance-preset-picker";
import { ModelPicker } from "./model-picker";
import { CharCounter } from "./char-counter";
import { ReferencePicker, type ReferenceImage } from "./reference-picker";
import { GeneratedImageGallery } from "./generated-image-gallery";
import { generateImages, getGenerationJobAction, saveGenerationResult } from "@/lib/generation/actions";
import { AUTO_MODEL_ID, MAX_NEGATIVE_PROMPT_LENGTH, effectiveMaxPromptLength, type ModelMeta } from "@/lib/generation/model-meta";
import {
  DEFAULT_HIGGSFIELD_SIZE,
  findHiggsfieldSize,
  higgsfieldSizeLabel,
  nearestHiggsfieldSize,
} from "@/lib/generation/providers/higgsfield-sizes";
import type { SizePreset } from "@/types/brand";
import type { LibraryAssetListItem } from "@/types/library";
import type { GeneratedImageGalleryItem } from "@/lib/generation/queries";

const HIGGSFIELD_MODEL_ID = "higgsfield-soul2";
const MARKETING_STUDIO_MODEL_ID = "higgsfield-marketing-studio";
const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_ATTEMPTS = 100; // ~150s — covers the fallback chain's own internal timeouts with margin

export function ImageComposer({
  brandId,
  presets,
  models,
  elements,
  initialGallery,
}: {
  /** Still required server-side (creative_assets.brand_id is NOT NULL)
   * but no longer a user-facing choice — resolved silently to the
   * workspace's first brand by the caller (page.tsx). No Thương hiệu
   * field anywhere in this component. */
  brandId: string | null;
  presets: SizePreset[];
  /** Server-resolved CONFIGURED models only (env vars never read on the
   * client) — see listAvailableModels() in lib/generation/providers. */
  models: ModelMeta[];
  /** Recent image assets for the "@ Elements" picker. */
  elements: LibraryAssetListItem[];
  initialGallery: GeneratedImageGalleryItem[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [count, setCount] = useState("1");
  const [model, setModel] = useState<string>(AUTO_MODEL_ID);
  const [sizePresetId, setSizePresetId] = useState<string>(presets[0]?.id ?? "");
  const [higgsfieldSize, setHiggsfieldSize] = useState<string>(DEFAULT_HIGGSFIELD_SIZE.value);
  const [aspectRatio, setAspectRatio] = useState<MarketingStudioAspectRatio>("auto");
  const [resolution, setResolution] = useState<MarketingStudioResolution>("1k");
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState<string | null>(null);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const selectedPreset = presets.find((p) => p.id === sizePresetId);
  const isHiggsfield = model === HIGGSFIELD_MODEL_ID;
  const isMarketingStudio = model === MARKETING_STUDIO_MODEL_ID;
  const isAuto = model === AUTO_MODEL_ID;
  const selectedModelMeta = models.find((m) => m.id === model);
  // "auto"'s fallback chain never includes Marketing Studio (its
  // aspect_ratio+resolution params can't be safely approximated from a
  // generic size preset — see providers/index.ts), so only Higgsfield
  // Soul's single reference slot applies to "auto".
  const maxReferenceImages = isAuto ? 1 : selectedModelMeta?.maxReferenceImages ?? 0;
  const supportsAspectRatioResolution = selectedModelMeta?.supportsAspectRatioResolution ?? false;
  const supportsPromptEnhancement = selectedModelMeta?.supportsPromptEnhancement ?? false;
  const maxPromptLength = effectiveMaxPromptLength(model, models);
  const promptOverLimit = prompt.length > maxPromptLength;
  const promptTooShort = prompt.trim().length > 0 && prompt.trim().length < 3;
  const negativePromptOverLimit = negativePrompt.length > MAX_NEGATIVE_PROMPT_LENGTH;

  const prevModelRef = useRef(model);
  useEffect(() => {
    const wasHiggsfield = prevModelRef.current === HIGGSFIELD_MODEL_ID;
    prevModelRef.current = model;
    if (wasHiggsfield || !isHiggsfield) return;
    const basisWidth = selectedPreset?.width ?? DEFAULT_HIGGSFIELD_SIZE.width;
    const basisHeight = selectedPreset?.height ?? DEFAULT_HIGGSFIELD_SIZE.height;
    const nearest = nearestHiggsfieldSize(basisWidth, basisHeight);
    setHiggsfieldSize(nearest.value);
    toast.message(
      `Higgsfield chỉ hỗ trợ một số tỷ lệ cố định — đã tự chọn kích thước gần nhất: ${higgsfieldSizeLabel(nearest)}.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to `model` changes
  }, [model]);

  // Switching to a model with a lower reference-image cap (or none) must
  // actually drop the extra slots — never silently send more images than
  // the new model's real API accepts. Switching away from Marketing
  // Studio also resets its enhance/preset state, since those fields are
  // meaningless (and never sent) for any other model. Applied directly in
  // the event handler that changes `model`, not an effect — this is
  // genuinely derived state that should be reset at the moment of the
  // triggering action, not recomputed reactively after the fact.
  function applyModelChangeSideEffects(nextModel: string) {
    const nextMeta = models.find((m) => m.id === nextModel);
    const nextMaxReferenceImages = nextModel === AUTO_MODEL_ID ? 1 : nextMeta?.maxReferenceImages ?? 0;
    setReferences((prev) => (prev.length > nextMaxReferenceImages ? prev.slice(0, nextMaxReferenceImages) : prev));
    if (!(nextMeta?.supportsPromptEnhancement ?? false)) {
      setEnhancePrompt(false);
      setPresetId(null);
      setPresetName(null);
    }
  }
  function handleModelChange(nextModel: string) {
    applyModelChangeSideEffects(nextModel);
    setModel(nextModel);
  }

  function handleCreateVariant(item: GeneratedImageGalleryItem) {
    setPrompt(item.prompt ?? "");
    if (item.requestedModel) {
      applyModelChangeSideEffects(item.requestedModel);
      setModel(item.requestedModel);
    }
    if (item.width && item.height) {
      if ((item.requestedModel ?? item.finalModel) === HIGGSFIELD_MODEL_ID) {
        setHiggsfieldSize(nearestHiggsfieldSize(item.width, item.height).value);
      }
    }
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.message("Đã điền lại thiết lập từ ảnh này — chỉnh mô tả rồi bấm Tạo ảnh để tạo biến thể.");
  }

  async function handleGenerate() {
    const sizeChosen = supportsAspectRatioResolution
      ? Boolean(aspectRatio && resolution)
      : isHiggsfield
        ? Boolean(higgsfieldSize)
        : Boolean(sizePresetId);
    const enhanceReady = !enhancePrompt || (Boolean(presetId) && references.length >= 1);
    if (
      generating ||
      !brandId ||
      !sizeChosen ||
      !enhanceReady ||
      !prompt.trim() ||
      promptOverLimit ||
      negativePromptOverLimit
    )
      return;

    setGenerating(true);
    setStatusText("Đang gửi yêu cầu...");
    try {
      const sizeFields = supportsAspectRatioResolution
        ? { aspectRatio, resolution }
        : isHiggsfield
          ? { exactSize: { width: findHiggsfieldSize(higgsfieldSize)!.width, height: findHiggsfieldSize(higgsfieldSize)!.height } }
          : { sizePresetId };
      const referenceFields = isMarketingStudio
        ? { referenceImageUrls: references.map((r) => r.url) }
        : { referenceImageUrl: references[0]?.url };
      const result = await generateImages({
        brandId,
        prompt,
        negativePrompt,
        ...sizeFields,
        ...referenceFields,
        count: Number(count),
        model,
        ...(supportsPromptEnhancement ? { enhancePrompt, presetId: enhancePrompt ? presetId ?? undefined : undefined } : {}),
      });
      if (!result.ok) {
        toast.error(result.error.message);
        setStatusText(null);
        return;
      }

      let job = null;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        job = await getGenerationJobAction(result.data.jobId);
        if (job && (job.status === "succeeded" || job.status === "failed")) break;
        if (job) {
          const last = job.attempts.at(-1);
          setStatusText(
            last?.status === "started"
              ? job.attempts.length > 1
                ? `Model gặp sự cố, đang chuyển sang ${last.model}…`
                : `Đang tạo bằng ${last.model}…`
              : "Đang tạo ảnh..."
          );
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!job || job.status !== "succeeded") {
        toast.error(job?.error || "Không thể tạo ảnh lúc này. Vui lòng thử lại.");
        setStatusText(null);
        return;
      }

      setStatusText("Đang lưu kết quả...");
      const savedAssets = await Promise.all(
        job.results
          .filter((r) => !r.isDemo)
          .map((r) => saveGenerationResult({ jobId: job!.id, outputIndex: r.index, name: prompt.slice(0, 80) }))
      );
      const failedSaves = savedAssets.filter((r) => !r.ok);
      if (failedSaves.length > 0) {
        console.error("[ImageComposer] saveGenerationResult failed", failedSaves);
      }

      toast.success(`Đã tạo ${job.results.length} ảnh.`);
      setStatusText(null);
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div ref={composerRef} className="rounded-xl ring-1 ring-border bg-card p-3 sm:p-4 flex flex-col gap-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Mô tả cảnh bạn muốn tạo..."
          rows={2}
          maxLength={maxPromptLength}
          aria-invalid={promptOverLimit}
          className="resize-none border-none bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
        />

        {showNegative ? (
          <div className="flex flex-col gap-1">
            <Input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Loại trừ — những gì không muốn xuất hiện..."
              maxLength={MAX_NEGATIVE_PROMPT_LENGTH}
              aria-invalid={negativePromptOverLimit}
            />
            <div className="flex justify-end">
              <CharCounter current={negativePrompt.length} max={MAX_NEGATIVE_PROMPT_LENGTH} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNegative(true)}
            className="w-fit text-xs text-muted-foreground hover:text-foreground"
          >
            + Thêm phần loại trừ
          </button>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <ReferencePicker
            values={references}
            onChange={setReferences}
            elements={elements}
            max={maxReferenceImages}
            disabled={maxReferenceImages === 0}
            disabledReason="Model đang chọn chưa xác nhận hỗ trợ ảnh tham chiếu."
          />

          <Popover>
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant="outline">
                  {supportsAspectRatioResolution
                    ? `${aspectRatio === "auto" ? "Tự động" : aspectRatio} · ${resolution.toUpperCase()}`
                    : isHiggsfield
                      ? findHiggsfieldSize(higgsfieldSize) && higgsfieldSizeLabel(findHiggsfieldSize(higgsfieldSize)!)
                      : selectedPreset
                        ? `${selectedPreset.name} ${selectedPreset.width}×${selectedPreset.height}`
                        : "Kích thước"}
                </Button>
              }
            />
            <PopoverContent align="start" className={supportsAspectRatioResolution || isHiggsfield ? "w-80" : "w-64"}>
              {supportsAspectRatioResolution ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tỷ lệ khung hình</p>
                    <AspectRatioPicker value={aspectRatio} onChange={setAspectRatio} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Độ phân giải</p>
                    <ResolutionPicker value={resolution} onChange={setResolution} />
                  </div>
                </div>
              ) : isHiggsfield ? (
                <HiggsfieldSizePicker value={higgsfieldSize} onChange={setHiggsfieldSize} />
              ) : (
                <SizePresetPicker presets={presets} value={sizePresetId} onChange={setSizePresetId} />
              )}
            </PopoverContent>
          </Popover>

          <div className="w-36">
            <ModelPicker models={models} value={model} onChange={handleModelChange} />
          </div>

          <div className="w-16">
            <Select value={count} onValueChange={(v) => v && setCount(v)}>
              <SelectTrigger>
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

          <Button
            type="button"
            size="lg"
            className="ml-auto"
            disabled={
              generating ||
              !prompt.trim() ||
              promptOverLimit ||
              negativePromptOverLimit ||
              (supportsAspectRatioResolution ? !aspectRatio || !resolution : isHiggsfield ? !higgsfieldSize : !sizePresetId) ||
              (enhancePrompt && (!presetId || references.length < 1))
            }
            onClick={handleGenerate}
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Đang tạo..." : "Tạo ảnh"}
          </Button>
        </div>

        {supportsPromptEnhancement && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={enhancePrompt}
                onClick={() => setEnhancePrompt((v) => !v)}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                  enhancePrompt ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-4 rounded-full bg-background transition-transform",
                    enhancePrompt ? "translate-x-4 left-0.5" : "left-0.5"
                  )}
                />
              </button>
              <span className="text-xs font-medium">Enhance theo preset</span>
              {presetName && enhancePrompt && <span className="text-xs text-muted-foreground">— {presetName}</span>}
            </div>
            {enhancePrompt && (
              <div className="rounded-lg border border-input p-2">
                {references.length < 1 && (
                  <p className="mb-2 text-xs text-destructive">
                    Chế độ Enhance cần ít nhất 1 ảnh sản phẩm tham chiếu — thêm ở nút Reference/Elements phía trên.
                  </p>
                )}
                <EnhancePresetPicker
                  value={presetId}
                  onChange={(id, name) => {
                    setPresetId(id);
                    setPresetName(name);
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {statusText ?? (promptOverLimit
              ? `Mô tả vượt giới hạn — tối đa ${maxPromptLength.toLocaleString("vi-VN")} ký tự.`
              : promptTooShort
                ? "Mô tả quá ngắn — cần ít nhất 3 ký tự."
                : " ")}
          </p>
          <CharCounter current={prompt.length} max={maxPromptLength} />
        </div>
      </div>

      <GeneratedImageGallery items={initialGallery} onCreateVariant={handleCreateVariant} />
    </div>
  );
}
