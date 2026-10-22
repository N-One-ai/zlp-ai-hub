"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { Loader2, Save, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditorCanvas } from "./canvas";
import { EditorToolbar } from "./toolbar";
import { LayerPanel } from "./layer-panel";
import { TextProperties } from "./text-properties";
import { GuidelinePanel } from "./guideline-panel";
import { saveDesignDocument, exportDesign, duplicateBannerAsset, getBrandImageAssetsAction } from "@/lib/design/actions";
import { uploadImageAsset } from "@/lib/generation/actions";
import { checkGuideline, hasBlockingFailure } from "@/lib/design/guideline-check";
import { trackEvent } from "@/lib/analytics/track";
import type { ResolvedLayer } from "@/types/design";
import type { GuidelineVersion } from "@/types/brand";
import type { ExportFormat } from "@/types/database";

const MAX_DISPLAY_WIDTH = 640;
const MAX_HISTORY = 50;

function newLayerId(): string {
  return `layer-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

/** PRD §8.5: "Tên file mặc định dễ nhận biết: thương hiệu, chiến dịch/tên
 * tài sản, preset và phiên bản." */
function buildExportFilename(
  brandName: string,
  assetName: string,
  presetName: string | null,
  version: number,
  format: string
): string {
  const parts = [slugify(brandName), slugify(assetName || "banner"), presetName ? slugify(presetName) : null, `v${version}`];
  return `${parts.filter(Boolean).join("-")}.${format}`;
}

export function EditorShell({
  assetId,
  brandId,
  brandName,
  assetName,
  presetName,
  documentId,
  documentVersion,
  presetWidth,
  presetHeight,
  initialLayers,
  guideline,
}: {
  assetId: string;
  brandId: string;
  brandName: string;
  assetName: string;
  presetName: string | null;
  documentId: string;
  documentVersion: number;
  presetWidth: number;
  presetHeight: number;
  initialLayers: ResolvedLayer[];
  guideline: GuidelineVersion | null;
}) {
  const router = useRouter();
  const stageRef = useRef<Konva.Stage>(null);

  const [currentDocumentId, setCurrentDocumentId] = useState(documentId);
  const [currentVersion, setCurrentVersion] = useState(documentVersion);
  const [layers, setLayers] = useState<ResolvedLayer[]>(initialLayers);
  const [history, setHistory] = useState<ResolvedLayer[][]>([initialLayers]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [bgImages, setBgImages] = useState<{ id: string; name: string; path: string; url: string | null }[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const displayScale = Math.min(1, MAX_DISPLAY_WIDTH / presetWidth);
  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;

  const results = useMemo(
    () => checkGuideline(layers, presetWidth, presetHeight, presetWidth, presetHeight, guideline),
    [layers, presetWidth, presetHeight, guideline]
  );
  const blocked = hasBlockingFailure(results);

  // Task 4.7 — no silent autosave (each save creates a new, visible
  // version; autosaving on a timer would create a confusing flood of
  // versions), instead warn before leaving with unsaved changes.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    void trackEvent({ name: "banner_editor_opened", assetId, brandId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per mount only, not on every assetId/brandId identity change within the same mount
  }, []);

  function pushHistory(next: ResolvedLayer[]) {
    setHistory((h) => {
      const truncated = h.slice(0, historyIndex + 1);
      const appended = [...truncated, next].slice(-MAX_HISTORY);
      setHistoryIndex(appended.length - 1);
      return appended;
    });
    setLayers(next);
    setDirty(true);
  }

  function updateLayer(id: string, patch: Partial<ResolvedLayer>) {
    pushHistory(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function handleUndo() {
    if (historyIndex === 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setLayers(history[nextIndex]);
    setDirty(true);
  }
  function handleRedo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setLayers(history[nextIndex]);
    setDirty(true);
  }

  function handleAddText() {
    const layer: ResolvedLayer = {
      id: newLayerId(),
      type: "text",
      x: presetWidth / 2 - 100,
      y: presetHeight / 2 - 20,
      width: 200,
      height: 40,
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
      text: "Nội dung mới",
      fontFamily: guideline?.fonts.heading?.family ?? "Inter",
      fontFallback: guideline?.fonts.heading?.fallback ?? "sans-serif",
      fontSize: 28,
      fontWeight: 700,
      color: guideline?.colors[0]?.hex ?? "#1c1917",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0,
    };
    pushHistory([...layers, layer]);
    setSelectedId(layer.id);
  }

  function handleAddShape(kind: "rect" | "ellipse") {
    const layer: ResolvedLayer = {
      id: newLayerId(),
      type: "shape",
      shapeKind: kind,
      x: presetWidth / 2 - 50,
      y: presetHeight / 2 - 50,
      width: 100,
      height: 100,
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
      fill: guideline?.colors[0]?.hex ?? "#a8a29e",
    };
    pushHistory([...layers, layer]);
    setSelectedId(layer.id);
  }

  function handleDeleteLayer(id: string) {
    pushHistory(layers.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleToggleLock(id: string) {
    updateLayer(id, { locked: !layers.find((l) => l.id === id)?.locked });
  }

  function handleReorder(id: string, direction: "up" | "down") {
    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((l) => l.id === id);
    const swapWith = direction === "up" ? idx + 1 : idx - 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapWith];
    const aZ = a.zIndex;
    pushHistory(layers.map((l) => (l.id === a.id ? { ...l, zIndex: b.zIndex } : l.id === b.id ? { ...l, zIndex: aZ } : l)));
  }

  async function openBackgroundPicker() {
    setBgPickerOpen(true);
    const assets = await getBrandImageAssetsAction(brandId);
    setBgImages(assets);
  }

  function applyBackground(path: string, url: string | null) {
    const bg = layers.find((l) => l.type === "background");
    if (bg) {
      updateLayer(bg.id, { imagePath: path, imageUrl: url });
    } else {
      pushHistory([
        ...layers,
        { id: newLayerId(), type: "background", x: 0, y: 0, width: presetWidth, height: presetHeight, rotation: 0, zIndex: 0, imagePath: path, imageUrl: url },
      ]);
    }
    setBgPickerOpen(false);
  }

  async function handleUploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await uploadImageAsset(brandId, file);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    const assets = await getBrandImageAssetsAction(brandId);
    const match = assets.find((a) => a.id === result.data.assetId);
    if (match) applyBackground(match.path, match.url);
  }

  /** Returns the saved (documentId, version) on success, or null — shared
   * by the explicit Save button and by Export (which must always save
   * first if there are unsaved edits, so the export it records never
   * references a stale version missing the user's latest changes). */
  const persistSave = useCallback(async (): Promise<{ documentId: string; version: number } | null> => {
    const result = await saveDesignDocument({ assetId, layers });
    if (!result.ok) {
      toast.error(result.error.message);
      return null;
    }
    setCurrentDocumentId(result.data.documentId);
    setCurrentVersion(result.data.version);
    setDirty(false);
    router.refresh();
    void trackEvent({
      name: "guideline_check_completed",
      assetId,
      failCount: results.filter((r) => r.severity === "fail").length,
      reviewCount: results.filter((r) => r.severity === "review").length,
    });
    return result.data;
  }, [assetId, layers, router, results]);

  function handleSave() {
    setIsSaving(true);
    persistSave()
      .then((result) => {
        if (result) toast.success(`Đã lưu (phiên bản ${result.version}).`);
      })
      .finally(() => setIsSaving(false));
  }

  async function handleExport() {
    if (blocked) {
      toast.error("Không thể xuất — còn lỗi cần sửa trước (xem mục Kiểm tra guideline).");
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;

    setIsExporting(true);
    try {
      let exportDocumentId = currentDocumentId;
      let exportVersion = currentVersion;
      if (dirty) {
        const saved = await persistSave();
        if (!saved) return; // save failed — don't export a version that was never recorded
        exportDocumentId = saved.documentId;
        exportVersion = saved.version;
      }

      // Native resolution regardless of on-screen display scale.
      const pixelRatio = 1 / displayScale;
      const dataUrl = stage.toDataURL({
        mimeType: exportFormat === "png" ? "image/png" : "image/jpeg",
        quality: 0.92,
        pixelRatio,
      });
      const res = await fetch(dataUrl);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const result = await exportDesign(
        { assetId, designDocumentId: exportDocumentId, format: exportFormat, width: presetWidth, height: presetHeight },
        bytes
      );
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Đã xuất file.");
      if (result.data.url) {
        const a = document.createElement("a");
        a.href = result.data.url;
        a.download = buildExportFilename(brandName, assetName, presetName, exportVersion, exportFormat);
        a.click();
      }
      router.refresh();
    } finally {
      setIsExporting(false);
    }
  }

  function handleDuplicate() {
    setIsDuplicating(true);
    duplicateBannerAsset(assetId)
      .then((result) => {
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        router.push(`/create/banner/${result.data.assetId}`);
      })
      .finally(() => setIsDuplicating(false));
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <EditorToolbar
            onAddText={handleAddText}
            onAddShape={handleAddShape}
            onReplaceBackground={openBackgroundPicker}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((v) => !v)}
            showSafeZone={showSafeZone}
            onToggleSafeZone={() => setShowSafeZone((v) => !v)}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={isDuplicating} onClick={handleDuplicate}>
              {isDuplicating ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
              Nhân bản
            </Button>
            <Button size="sm" variant="outline" disabled={isSaving || !dirty} onClick={handleSave}>
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Lưu
            </Button>
            <Select value={exportFormat} onValueChange={(v) => v && setExportFormat(v as ExportFormat)}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpg">JPG</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" disabled={isExporting || blocked} onClick={handleExport}>
              {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              Xuất
            </Button>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border bg-muted/30 p-4 flex items-center justify-center">
          <EditorCanvas
            layers={layers}
            width={presetWidth}
            height={presetHeight}
            displayScale={displayScale}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChangeLayer={updateLayer}
            showGrid={showGrid}
            showSafeZone={showSafeZone}
            safeZone={guideline?.safeZone ?? {}}
            stageRef={stageRef}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full lg:w-72 shrink-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lớp</CardTitle>
          </CardHeader>
          <CardContent>
            <LayerPanel
              layers={layers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleLock={handleToggleLock}
              onDelete={handleDeleteLayer}
              onReorder={handleReorder}
            />
          </CardContent>
        </Card>

        {selectedLayer?.type === "text" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Thuộc tính chữ</CardTitle>
            </CardHeader>
            <CardContent>
              <TextProperties layer={selectedLayer} onChange={(patch) => updateLayer(selectedLayer.id, patch)} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kiểm tra guideline</CardTitle>
          </CardHeader>
          <CardContent>
            <GuidelinePanel results={results} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={bgPickerOpen} onOpenChange={setBgPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thay ảnh nền</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {bgImages.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => applyBackground(img.path, img.url)}
                className="aspect-square rounded-md border overflow-hidden bg-muted/40"
              >
                {img.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={img.url} alt={img.name} className="size-full object-cover" />
                )}
              </button>
            ))}
          </div>
          <label className="text-sm text-muted-foreground underline cursor-pointer w-fit">
            Hoặc tải ảnh mới lên
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadBackground} className="hidden" />
          </label>
        </DialogContent>
      </Dialog>
    </div>
  );
}
