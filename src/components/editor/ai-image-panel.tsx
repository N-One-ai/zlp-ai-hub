"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CharCounter } from "@/components/generate/char-counter";
import { generateImages, getGenerationJobAction, uploadImageAsset, resolveAssetAsReference } from "@/lib/generation/actions";
import { effectiveMaxPromptLength, type ModelMeta } from "@/lib/generation/model-meta";
import { pngHasAlphaChannel } from "@/lib/generation/image-dimensions";
import {
  segmentForeground,
  isUnreliableSegmentation,
  featherMask,
  loadImageData,
  compositeToPngBlob,
  extractAlphaMask,
  hasRealTransparency,
  type SegmentationResult,
} from "@/lib/image-processing/background-removal";
import type { GenerationJob } from "@/types/generation";

const MARKETING_STUDIO_MODEL_ID = "higgsfield-marketing-studio";
const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_ATTEMPTS = 100;
const FEATHER_DEFAULT = 8;
const FEATHER_MAX = 64;
// Confirmed live (2026-10-25): resolution "1k" + aspect_ratio "1:1" on
// Marketing Studio produced a real 1024x1024 PNG — the one combination
// independently verified pixel-for-pixel, and light enough for the
// client-side segmentation/feather math below to stay fast.
const SQUARE_RESOLUTION = "1k";

type Stage = "idle" | "generating" | "segmenting" | "ready" | "placing" | "error";

/**
 * "Tạo hình ảnh bằng AI" — generates a SQUARE (1:1) foreground subject
 * conditioned on the banner's current background (sent as a reference
 * image to Marketing Studio's direct/edit mode — the same Higgsfield
 * integration and server-side HF_CREDENTIALS as the rest of the app, no
 * second provider). Marketing Studio is required here (not Soul): only
 * its request schema takes an explicit aspect_ratio, and Soul has no
 * "1:1-but-small" option in its 16-value catalog that's as predictably
 * square.
 *
 * Higgsfield's real output has NO alpha channel (confirmed live — see
 * background-removal.ts's file header) despite prompting for an isolated
 * subject, so this panel runs a LOCAL, pixel-based flood-fill cutout in
 * the browser (no ML model, no third-party service, no upload to
 * anywhere but this app's own Supabase Storage) to produce a real RGBA
 * PNG, then lets the user soften the cutout edge with a live Feather
 * slider before placing it as its own movable/resizable layer — the
 * background layer is never touched.
 */
export function AiImagePanel({
  open,
  onOpenChange,
  brandId,
  backgroundImageUrl,
  models,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  backgroundImageUrl: string;
  models: ModelMeta[];
  onConfirm: (result: { imagePath: string; imageUrl: string; width: number; height: number; featherPx: number }) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [feather, setFeather] = useState(FEATHER_DEFAULT);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [unreliable, setUnreliable] = useState(false);

  // Kept across the "generating" -> "segmenting" -> "ready" lifecycle,
  // never sent anywhere again — all pure client-side recomputation on
  // feather changes, no re-generation and no re-upload per slider tick.
  const sourceImageDataRef = useRef<ImageData | null>(null);
  const segmentationRef = useRef<SegmentationResult | null>(null);
  const recomputeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const referenceModel = models.find((m) => m.id === MARKETING_STUDIO_MODEL_ID) ?? null;
  const maxPromptLength = referenceModel ? effectiveMaxPromptLength(referenceModel.id, models) : 1000;
  const promptOverLimit = prompt.length > maxPromptLength;
  const busy = stage === "generating" || stage === "segmenting" || stage === "placing";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (recomputeTimerRef.current) clearTimeout(recomputeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only, intentionally not reactive
  }, []);

  /** Clears everything EXCEPT the prompt text — used right before a new
   * generation starts (so a retry after an error, or a feather re-roll,
   * doesn't wipe out what the user just typed) and whenever "Tạo lại" is
   * pressed from the ready/error state. */
  function resetGenerationState() {
    setStage("idle");
    setStatusText(null);
    setErrorText(null);
    setFeather(FEATHER_DEFAULT);
    setUnreliable(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    sourceImageDataRef.current = null;
    segmentationRef.current = null;
  }

  /** Full reset including the prompt — only on dialog close or after a
   * successful placement. */
  function resetAll() {
    resetGenerationState();
    setPrompt("");
  }

  async function renderPreview(featherValue: number) {
    const imageData = sourceImageDataRef.current;
    const segmentation = segmentationRef.current;
    if (!imageData || !segmentation) return;
    // compositeToPngBlob mutates imageData's alpha in place — work on a
    // fresh copy each time so the ORIGINAL decoded pixels/mask stay
    // reusable for the next feather value.
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const softened = featherMask(segmentation.mask, segmentation.width, segmentation.height, featherValue);
    const blob = await compositeToPngBlob(copy, softened);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }

  function handleFeatherChange(value: number) {
    setFeather(value);
    if (recomputeTimerRef.current) clearTimeout(recomputeTimerRef.current);
    recomputeTimerRef.current = setTimeout(() => {
      void renderPreview(value);
    }, 60);
  }

  async function handleGenerate() {
    if (!referenceModel || busy || !prompt.trim() || promptOverLimit) return;
    resetGenerationState();
    setStage("generating");
    setStatusText("Đang gửi yêu cầu...");
    try {
      const result = await generateImages({
        brandId,
        prompt,
        negativePrompt: "",
        count: 1,
        model: referenceModel.id,
        aspectRatio: "1:1",
        resolution: SQUARE_RESOLUTION,
        referenceImageUrls: [backgroundImageUrl],
      });
      if (!result.ok) {
        setStage("error");
        setErrorText(`Không gửi được yêu cầu tạo ảnh: ${result.error.message}`);
        return;
      }

      let job: GenerationJob | null = null;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        job = await getGenerationJobAction(result.data.jobId);
        if (job && (job.status === "succeeded" || job.status === "failed")) break;
        if (job) {
          const last = job.attempts.at(-1);
          setStatusText(last?.status === "started" ? `Đang tạo bằng ${last.model}…` : "Đang tạo ảnh...");
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!job || job.status !== "succeeded" || !job.results[0]?.url) {
        setStage("error");
        setErrorText(job?.error ? `Tạo ảnh thất bại: ${job.error}` : "Tạo ảnh thất bại — không rõ nguyên nhân, thử lại.");
        return;
      }

      // Check the RAW bytes for a real alpha channel BEFORE running any
      // local cutout — never assume Higgsfield's output is opaque, and
      // never run the heuristic over an image that's already genuinely
      // transparent (confirmed live, 2026-10-25: today's real output is
      // RGB/no-alpha, but this must keep holding even if that changes).
      let rawBytes: Uint8Array;
      try {
        const rawResponse = await fetch(job.results[0].url);
        rawBytes = new Uint8Array(await rawResponse.arrayBuffer());
      } catch (e) {
        setStage("error");
        setErrorText(`Không tải được ảnh gốc để kiểm tra: ${(e as Error).message}`);
        return;
      }

      setStage("segmenting");
      setStatusText("Đang tách nền...");
      let imageData: ImageData;
      try {
        const loaded = await loadImageData(job.results[0].url);
        imageData = loaded.imageData;
      } catch (e) {
        setStage("error");
        setErrorText(`Không đọc được ảnh để tách nền: ${(e as Error).message}`);
        return;
      }

      if (pngHasAlphaChannel(rawBytes) && hasRealTransparency(imageData)) {
        // Provider already returned real alpha — use it AS-IS, no local
        // heuristic needed (and none would be more trustworthy than the
        // provider's own mask anyway).
        sourceImageDataRef.current = imageData;
        segmentationRef.current = {
          mask: extractAlphaMask(imageData),
          width: imageData.width,
          height: imageData.height,
          backgroundRatio: 0, // not computed by a local heuristic — not meaningful here
        };
        await renderPreview(FEATHER_DEFAULT);
        setStage("ready");
        setStatusText(null);
        return;
      }

      const segmentation = segmentForeground(imageData);
      if (isUnreliableSegmentation(segmentation)) {
        setStage("error");
        setUnreliable(true);
        setErrorText(
          "Không tách nền đáng tin cậy được cho ảnh này (nền không đủ đồng nhất/trơn). Ảnh KHÔNG có nền trong suốt thật. Thử lại với mô tả nền đơn giản hơn (ví dụ: nền trắng trơn), hoặc đặt ảnh lên banner ở dạng không trong suốt."
        );
        sourceImageDataRef.current = imageData;
        segmentationRef.current = segmentation;
        return;
      }

      sourceImageDataRef.current = imageData;
      segmentationRef.current = segmentation;
      await renderPreview(FEATHER_DEFAULT);
      setStage("ready");
      setStatusText(null);
    } catch (e) {
      setStage("error");
      setErrorText(`Lỗi không mong muốn: ${(e as Error).message}`);
    }
  }

  async function handlePlaceOnBanner(opaque: boolean) {
    const imageData = sourceImageDataRef.current;
    if (!imageData) return;
    setStage("placing");
    try {
      const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
      // The STORED file always bakes in the HARD mask (feather=0, already
      // computed once by handleGenerate) — feather itself stays a live,
      // re-adjustable layer property (see use-feathered-image.ts), never
      // re-baked here.
      const mask =
        opaque || !segmentationRef.current
          ? new Uint8ClampedArray(imageData.width * imageData.height).fill(255)
          : segmentationRef.current.mask;
      const blob = await compositeToPngBlob(copy, mask);
      const file = new File([blob], "ai-cutout.png", { type: "image/png" });

      const uploaded = await uploadImageAsset(brandId, file, { prompt });
      if (!uploaded.ok) {
        setStage("error");
        setErrorText(`Không lưu được ảnh vào thư viện: ${uploaded.error.message}`);
        return;
      }
      // A real, server-signed Storage URL for the canvas to render —
      // never the ephemeral blob: object URL used for the in-dialog
      // preview, which gets revoked as soon as this dialog resets.
      const signedUrl = await resolveAssetAsReference(uploaded.data.assetId);
      if (!signedUrl.ok) {
        setStage("error");
        setErrorText(`Đã lưu ảnh nhưng không lấy được URL hiển thị: ${signedUrl.error.message}`);
        return;
      }
      onConfirm({
        imagePath: uploaded.data.path,
        imageUrl: signedUrl.data.url,
        width: uploaded.data.width ?? imageData.width,
        height: uploaded.data.height ?? imageData.height,
        featherPx: opaque ? 0 : feather,
      });
      toast.success(opaque ? "Đã thêm ảnh (không trong suốt) vào banner." : "Đã thêm ảnh vào banner.");
      resetAll();
      onOpenChange(false);
    } catch (e) {
      setStage("error");
      setErrorText(`Lỗi khi xử lý ảnh cuối: ${(e as Error).message}`);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAll();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Sparkles className="size-4" />
            Tạo hình ảnh bằng AI
          </DialogTitle>
        </DialogHeader>

        {!referenceModel ? (
          <p className="text-sm text-muted-foreground">
            Chưa cấu hình model Higgsfield Marketing Studio (cần cho ảnh vuông 1:1 có thể tách nền) — liên hệ Admin để
            thêm HF_CREDENTIALS.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Ảnh nền hiện tại được gửi làm tham chiếu. Mô tả chủ thể muốn tạo — nên mô tả thêm nền đơn giản/trơn (ví
              dụ: &ldquo;trên nền trắng trơn&rdquo;) để tách nền chính xác hơn. Kết quả luôn là ảnh vuông 1:1.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ví dụ: một hộp sản phẩm màu trắng, chụp studio, trên nền trắng trơn..."
              rows={3}
              maxLength={maxPromptLength}
              aria-invalid={promptOverLimit}
              disabled={busy}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {promptOverLimit ? `Vượt giới hạn — tối đa ${maxPromptLength.toLocaleString("vi-VN")} ký tự.` : statusText ?? " "}
              </p>
              <CharCounter current={prompt.length} max={maxPromptLength} />
            </div>

            {stage === "error" && errorText && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>{errorText}</span>
              </div>
            )}

            {stage === "error" && unreliable ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => void handlePlaceOnBanner(true)}>
                  Đặt ảnh không trong suốt lên banner
                </Button>
                <Button type="button" variant="ghost" onClick={resetGenerationState}>
                  Huỷ
                </Button>
              </div>
            ) : (stage === "ready" || stage === "placing") && previewUrl ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Nền caro</span>
                    <div
                      className="aspect-square rounded-lg border overflow-hidden"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)",
                        backgroundSize: "16px 16px",
                        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                        backgroundColor: "#c0c0c0",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- object URL, not a remote asset */}
                      <img src={previewUrl} alt="Xem trước trên nền caro" className="size-full object-contain" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Trên nền banner thật</span>
                    <div
                      className="aspect-square rounded-lg border overflow-hidden bg-cover bg-center"
                      style={{ backgroundImage: `url(${backgroundImageUrl})` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- object URL, not a remote asset */}
                      <img src={previewUrl} alt="Xem trước trên nền banner" className="size-full object-contain" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Feather viền</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">{feather}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={FEATHER_MAX}
                    step={1}
                    value={feather}
                    onChange={(e) => handleFeatherChange(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" onClick={() => void handlePlaceOnBanner(false)} disabled={stage === "placing"}>
                    {stage === "placing" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Đặt lên banner
                  </Button>
                  <Button type="button" variant="outline" disabled={stage === "placing"} onClick={resetGenerationState}>
                    <X className="size-4" />
                    Tạo lại
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" disabled={busy || !prompt.trim() || promptOverLimit} onClick={handleGenerate} className="w-fit">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-3.5" />}
                {stage === "generating" ? "Đang tạo..." : stage === "segmenting" ? "Đang tách nền..." : "Tạo ảnh"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
