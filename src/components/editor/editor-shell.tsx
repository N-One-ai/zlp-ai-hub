"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { Loader2, Save, Download, Copy, Sparkles, Trash2, Pencil, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditorCanvas } from "./canvas";
import { EditorToolbar } from "./toolbar";
import { LayerPanel } from "./layer-panel";
import { TextProperties } from "./text-properties";
import { ImageProperties } from "./image-properties";
import { TextContentPanel } from "./text-content-panel";
import { LogoPanel } from "./logo-panel";
import { AiImagePanel } from "./ai-image-panel";
import { GuidelinePanel } from "./guideline-panel";
import { ElementsPanel, type ElementAsset } from "./elements-panel";
import { CollapsibleCard } from "./collapsible-card";
import { BrandPicker } from "@/components/brand/brand-picker";
import { SizePresetCards } from "@/components/brand/size-preset-cards";
import { ModelPicker } from "@/components/generate/model-picker";
import { ReferencePicker, type ReferenceImage } from "@/components/generate/reference-picker";
import {
  saveDesignDocument,
  exportDesign,
  duplicateBannerAsset,
  changeBannerBrand,
  getBrandImageAssetsAction,
  getBrandElementAssetsAction,
  getBannerFamilyAction,
} from "@/lib/design/actions";
import {
  uploadImageAsset,
  generateImages,
  getGenerationJobAction,
  saveGenerationResult,
  resolveAssetAsReference,
} from "@/lib/generation/actions";
import { renameAsset } from "@/lib/library/actions";
import { checkGuideline, hasBlockingFailure } from "@/lib/design/guideline-check";
import { scaleLayersToSize } from "@/lib/design/resize";
import { getDefaultLogoBox } from "@/lib/design/logo-size";
import { buildExportFilename } from "@/lib/design/export-filename";
import { AdaptSizesDialog } from "./adapt-sizes-dialog";
import { BannerVariantsPanel } from "./banner-variants-panel";
import { trackEvent } from "@/lib/analytics/track";
import type { ResolvedLayer } from "@/types/design";
import type { Brand, GuidelineVersion, SizePreset } from "@/types/brand";
import type { ExportFormat } from "@/types/database";
import type { LibraryAssetListItem } from "@/types/library";
import type { BannerFamilyMember } from "@/lib/design/queries";
import { AUTO_MODEL_ID, effectiveMaxPromptLength, type ModelMeta } from "@/lib/generation/model-meta";
import { CharCounter } from "@/components/generate/char-counter";
import type { GenerationJob } from "@/types/generation";

const AI_REGION_POLL_INTERVAL_MS = 1_500;
const AI_REGION_POLL_MAX_ATTEMPTS = 100;

// Same model id this app duplicates as a local const in every composer
// that needs to special-case it (image-composer.tsx, ai-image-panel.tsx,
// character-builder.tsx) — Marketing Studio is the only model whose real
// API takes aspect_ratio+resolution instead of literal width/height.
const MARKETING_STUDIO_MODEL_ID = "higgsfield-marketing-studio";
const REGION_RESOLUTIONS = ["1k", "2k"] as const;
type RegionResolution = (typeof REGION_RESOLUTIONS)[number];
// Marketing Studio's 9 confirmed aspect_ratio values (see
// aspect-ratio-picker.tsx) minus "auto" — a region already has a real
// drawn box, so the nearest DISCRETE ratio is always picked automatically
// rather than exposing yet another control the brief didn't ask for.
const REGION_ASPECT_RATIOS = ["1:1", "21:9", "16:9", "3:2", "4:3", "3:4", "2:3", "9:16"] as const;
function nearestRegionAspectRatio(width: number, height: number): (typeof REGION_ASPECT_RATIOS)[number] {
  const ratio = width / Math.max(1, height);
  let best: (typeof REGION_ASPECT_RATIOS)[number] = "1:1";
  let bestDiff = Infinity;
  for (const candidate of REGION_ASPECT_RATIOS) {
    const [w, h] = candidate.split(":").map(Number);
    const diff = Math.abs(Math.log(ratio) - Math.log(w / h));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
}

const MAX_DISPLAY_WIDTH = 640;
const MAX_HISTORY = 50;

function newLayerId(): string {
  return `layer-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function EditorShell({
  assetId,
  brandId: initialBrandId,
  brandName: initialBrandName,
  brands,
  assetName,
  presetName,
  documentId,
  documentVersion,
  presetWidth,
  presetHeight,
  initialSizePresetId,
  initialLayers,
  initialSizeVariants,
  presets,
  guideline: initialGuideline,
  models,
  referenceAssets,
}: {
  assetId: string;
  brandId: string;
  brandName: string;
  /** Every ACTIVE brand in the workspace — lets the user switch which
   * brand this banner belongs to in-editor (see handleChangeBrand),
   * without going back to a setup step. */
  brands: Brand[];
  assetName: string;
  presetName: string | null;
  documentId: string;
  documentVersion: number;
  presetWidth: number;
  presetHeight: number;
  initialSizePresetId: string | null;
  initialLayers: ResolvedLayer[];
  /** Other size presets already visited for this asset — see
   * DesignDocumentContent.sizeVariants. */
  initialSizeVariants: Record<string, ResolvedLayer[]>;
  /** Every size preset in the workspace — lets the user switch sizes
   * in-editor without going back to the setup step. */
  presets: SizePreset[];
  guideline: GuidelineVersion | null;
  /** Server-resolved CONFIGURED models only — see listAvailableModels(). */
  models: ModelMeta[];
  /** Workspace's recent image assets for the "Vùng tạo ảnh AI" panel's
   * Reference/"@ Elements" picker — same prop ImageComposer gets on the
   * Tạo ảnh page (see ReferencePicker), NOT the decorative Elements
   * library above (ElementsPanel/getBrandElementAssetsAction), which is a
   * different feature despite the similarly-named button inside
   * ReferencePicker itself. */
  referenceAssets: LibraryAssetListItem[];
}) {
  const router = useRouter();
  const stageRef = useRef<Konva.Stage>(null);

  // Brand/guideline start from the server-resolved props but become local
  // state so handleChangeBrand can swap them in-place after the server
  // action responds, instead of forcing a full page reload just to show
  // the new brand's logo/colors.
  const [brandId, setBrandId] = useState(initialBrandId);
  const [brandName, setBrandName] = useState(initialBrandName);
  const [guideline, setGuideline] = useState(initialGuideline);
  const [isBrandChanging, setIsBrandChanging] = useState(false);

  // Banner's own display name — integrates with creative_assets.name,
  // the SAME field the Library/Dashboard already read/rename (renameAsset
  // from lib/library/actions.ts), never a separate "banner title" column.
  const [bannerName, setBannerName] = useState(assetName);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(assetName);
  const [savingName, setSavingName] = useState(false);

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
  const [elements, setElements] = useState<ElementAsset[]>([]);
  const [elementsLoading, setElementsLoading] = useState(true);
  const [elementsUploading, setElementsUploading] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  // "Tạo phiên bản kích thước khác" — this asset's whole size-variant
  // family (itself if it's the root, or root+siblings if it's a variant —
  // see getBannerFamilyAction). familyRootId starts as this asset's own
  // id and is corrected once the real root comes back (only differs when
  // this page itself IS a variant).
  const [familyRootId, setFamilyRootId] = useState(assetId);
  const [familyMembers, setFamilyMembers] = useState<BannerFamilyMember[]>([]);
  const [adaptDialogOpen, setAdaptDialogOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"select" | "ai-region">("select");
  const [regionGenerating, setRegionGenerating] = useState(false);
  const [regionStatus, setRegionStatus] = useState<string | null>(null);
  const [regionModel, setRegionModel] = useState<string>(AUTO_MODEL_ID);
  const [regionReferences, setRegionReferences] = useState<ReferenceImage[]>([]);
  const [regionResolution, setRegionResolution] = useState<RegionResolution>("1k");

  // The active size preset lives in state (not just a prop) so switching
  // it in-editor updates the canvas/preview immediately — see
  // handleChangeSize. `sizeVariants` caches every OTHER size the user has
  // already visited this session, so flipping back restores it exactly
  // instead of re-deriving it.
  const [size, setSize] = useState({
    id: initialSizePresetId,
    name: presetName,
    width: presetWidth,
    height: presetHeight,
  });
  const [sizeVariants, setSizeVariants] = useState<Record<string, ResolvedLayer[]>>(initialSizeVariants);

  const displayScale = Math.min(1, MAX_DISPLAY_WIDTH / size.width);
  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;
  // Same single-source-of-truth used by image-composer.tsx/ai-image-
  // panel.tsx — mirrors the ACTUAL selected model's real capability
  // (every configured model currently supports 32,000 chars) rather than
  // an arbitrary, lower, unrelated app-only cap.
  const regionMaxPromptLength = effectiveMaxPromptLength(regionModel, models);
  const regionPromptOverLimit = (selectedLayer?.aiPrompt ?? "").length > regionMaxPromptLength;
  const isRegionMarketingStudio = regionModel === MARKETING_STUDIO_MODEL_ID;
  const isRegionAutoModel = regionModel === AUTO_MODEL_ID;
  const regionModelMeta = models.find((m) => m.id === regionModel);
  // "auto"'s own fallback chain never includes Marketing Studio (see
  // providers/index.ts) — only Higgsfield Soul's single reference slot
  // ever applies when "Tự động chọn" is picked, same reasoning
  // image-composer.tsx already documents for its own maxReferenceImages.
  const regionMaxReferenceImages = isRegionAutoModel ? 1 : (regionModelMeta?.maxReferenceImages ?? 0);
  const backgroundLayer = layers.find((l) => l.type === "background") ?? null;
  const taglineLayer = layers.find((l) => l.role === "tagline") ?? null;
  const subtitleLayer = layers.find((l) => l.role === "subtitle") ?? null;

  const results = useMemo(
    () => checkGuideline(layers, size.width, size.height, size.width, size.height, guideline),
    [layers, size.width, size.height, guideline]
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

  // Elements library is scoped per brand (same convention as background
  // images) — reloaded on mount and whenever the banner's brand changes.
  // The loading indicator only covers the very first fetch (elementsLoading
  // starts true); a brand switch refetches silently in the background
  // rather than re-showing a spinner over an already-populated grid.
  useEffect(() => {
    let cancelled = false;
    getBrandElementAssetsAction(brandId).then((result) => {
      if (cancelled) return;
      setElements(result);
      setElementsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const refreshFamily = useCallback(() => {
    getBannerFamilyAction(assetId).then((result) => {
      setFamilyRootId(result.rootId);
      setFamilyMembers(result.members);
    });
  }, [assetId]);

  useEffect(() => {
    refreshFamily();
  }, [refreshFamily]);

  /** Commits the editable banner title via the SAME renameAsset() the
   * Library already uses for every other asset type — never a separate
   * "banner title" field/table. Trims and falls back to the DB's own
   * "Chưa đặt tên" convention (empty string) when cleared, matching
   * renameAsset's own documented behavior. Reverts the draft to the last
   * saved name on failure, so the header never shows a name that wasn't
   * actually persisted. */
  async function commitNameEdit() {
    const trimmed = nameDraft.trim();
    if (trimmed === bannerName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const result = await renameAsset(assetId, trimmed);
      if (!result.ok) {
        toast.error(result.error.message);
        setNameDraft(bannerName);
        return;
      }
      setBannerName(trimmed);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  /** Selecting a layer also restores an ai-region's OWN saved Reference/
   * model/resolution choices into the panel's working state — called
   * directly from the two real "user clicked a layer" entry points
   * (canvas, layer list), never a useEffect keyed on selectedLayer, so
   * this is a one-shot sync at the moment of selection, not a recurring
   * re-derivation that could clobber an in-progress edit. */
  function selectLayer(id: string | null) {
    setSelectedId(id);
    const layer = id ? layers.find((l) => l.id === id) : null;
    if (layer?.type !== "ai-region") return;
    setRegionModel(layer.aiModel ?? AUTO_MODEL_ID);
    setRegionResolution(layer.aiResolution ?? "1k");
    const paths = layer.aiReferenceImagePaths ?? [];
    const urls = layer.aiReferenceImageUrls ?? [];
    const restored: ReferenceImage[] = [];
    for (let i = 0; i < paths.length; i++) {
      const url = urls[i];
      if (url) restored.push({ url, label: "Ảnh tham chiếu đã lưu", path: paths[i] });
    }
    setRegionReferences(restored);
  }

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
      x: size.width / 2 - 100,
      y: size.height / 2 - 20,
      width: 200,
      height: 40,
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
      text: "Nội dung mới",
      fontFamily: guideline?.fonts.heading?.family ?? "Aeonik Pro",
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
      x: size.width / 2 - 50,
      y: size.height / 2 - 50,
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

  function handleToggleVisible(id: string) {
    const layer = layers.find((l) => l.id === id);
    updateLayer(id, { visible: layer?.visible === false });
  }

  /** Tagline/subtitle each live in exactly one role-tagged text layer.
   * Typing creates the layer on the first non-empty keystroke (never
   * pre-filled with placeholder content), updates its text afterward, and
   * removes it again once cleared back to empty — no stray empty text
   * layer left cluttering the layer list. Default Y is derived from the
   * LOGO's real position/height (60px top + 60px tall, per the logo
   * default below) plus the required 170px gap — only falling back to a
   * proportional canvas position when there's no logo layer yet. */
  function handleTextContentChange(role: "tagline" | "subtitle", text: string) {
    const existing = layers.find((l) => l.role === role);
    if (existing) {
      if (text.trim() === "") {
        pushHistory(layers.filter((l) => l.id !== existing.id));
        if (selectedId === existing.id) setSelectedId(null);
      } else {
        updateLayer(existing.id, { text });
      }
      return;
    }
    if (text.trim() === "") return;

    const isTagline = role === "tagline";
    const height = isTagline ? 48 : 28;
    const logoLayer = layers.find((l) => l.type === "logo");
    const taglineLayer = layers.find((l) => l.role === "tagline");
    const y = isTagline
      ? logoLayer
        ? logoLayer.y + logoLayer.height + 170
        : size.height * 0.72
      : taglineLayer
        ? taglineLayer.y + taglineLayer.height + 16
        : logoLayer
          ? logoLayer.y + logoLayer.height + 170 + 48 + 16
          : size.height * 0.84;

    const layer: ResolvedLayer = {
      id: newLayerId(),
      type: "text",
      role,
      x: logoLayer?.x ?? size.width * 0.1,
      y,
      width: size.width * 0.8,
      height,
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
      text,
      fontFamily: guideline?.fonts.heading?.family ?? "Aeonik Pro",
      fontFallback: guideline?.fonts.heading?.fallback ?? "sans-serif",
      fontSize: isTagline ? 36 : 18,
      fontWeight: isTagline ? 700 : 400,
      color: guideline?.colors[0]?.hex ?? "#ffffff",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0,
    };
    pushHistory([...layers, layer]);
  }

  /** Real natural pixel size of an image URL, read via the browser's own
   * decoder (works for raster AND SVG) — used only to size a NEWLY placed
   * logo so its width follows its real aspect ratio instead of being
   * forced into a square. Never blocks the UI long: resolves null on
   * error/timeout rather than hanging. */
  function loadNaturalSize(url: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  /** Switching between "Logo màu"/"Logo trắng" only ever swaps the asset
   * on the EXISTING logo layer — position/size stay exactly as they are,
   * per spec. The very first time a logo is placed (no logo layer yet),
   * it's created at the active size preset's deterministic default box
   * (see getDefaultLogoBox), with width always derived from the chosen
   * asset's real natural aspect ratio — never set independently from
   * height — so it's never stretched. */
  async function applyLogoVariant(_variant: "color" | "white", path: string, url: string) {
    const existing = layers.find((l) => l.type === "logo");
    if (existing) {
      updateLayer(existing.id, { imagePath: path, imageUrl: url });
      return;
    }
    const natural = await loadNaturalSize(url);
    const aspect = natural ? natural.width / natural.height : 1;
    const box = getDefaultLogoBox(size.width, size.height, aspect, guideline?.safeZone);
    const layer: ResolvedLayer = {
      id: newLayerId(),
      type: "logo",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
      imagePath: path,
      imageUrl: url,
      locked: true,
    };
    pushHistory([...layers, layer]);
  }

  /** The "Tạo hình ảnh bằng AI" panel hands back a saved library asset's
   * path/size — placed as an ordinary movable "image" layer, scaled down
   * to fit the canvas if the real generated pixel size is larger, never
   * merged into the background. `featherPx` seeds the layer's live,
   * re-adjustable feather (see use-feathered-image.ts) at whatever value
   * was last set in the panel's preview. */
  function handlePlaceAiImage(result: { imagePath: string; imageUrl: string; width: number; height: number; featherPx: number }) {
    const maxW = size.width * 0.6;
    const maxH = size.height * 0.6;
    const scale = Math.min(1, maxW / result.width, maxH / result.height);
    const width = Math.round(result.width * scale);
    const height = Math.round(result.height * scale);
    const layer: ResolvedLayer = {
      id: newLayerId(),
      type: "image",
      x: Math.round((size.width - width) / 2),
      y: Math.round((size.height - height) / 2),
      width,
      height,
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
      imagePath: result.imagePath,
      imageUrl: result.imageUrl,
      featherPx: result.featherPx,
    };
    pushHistory([...layers, layer]);
    setSelectedId(layer.id);
  }

  /** Adds a library element as a brand-new, independently movable layer —
   * scaled down (never up, never distorted — keeps the real aspect ratio
   * from its stored width/height) to fit within a reasonable fraction of
   * the canvas so a large source image doesn't swamp the banner, same
   * "scale down to fit, center" convention as handlePlaceAiImage above. */
  function handleAddElement(element: ElementAsset) {
    if (!element.url) return;
    const naturalWidth = element.width ?? 200;
    const naturalHeight = element.height ?? 200;
    const maxW = size.width * 0.4;
    const maxH = size.height * 0.4;
    const scale = Math.min(1, maxW / naturalWidth, maxH / naturalHeight);
    const width = Math.max(8, Math.round(naturalWidth * scale));
    const height = Math.max(8, Math.round(naturalHeight * scale));
    const layer: ResolvedLayer = {
      id: newLayerId(),
      type: "element",
      x: Math.round((size.width - width) / 2),
      y: Math.round((size.height - height) / 2),
      width,
      height,
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
      imagePath: element.path,
      imageUrl: element.url,
    };
    pushHistory([...layers, layer]);
    setSelectedId(layer.id);
  }

  /** Uploads a new decorative asset into the SAME creative_assets table
   * background images already use (uploadImageAsset), just tagged
   * "element" so it shows up in this library instead of the background
   * picker. Only adds it to the grid above — never auto-places it on the
   * canvas, so uploading several at once doesn't surprise the user. */
  async function handleUploadElement(file: File) {
    setElementsUploading(true);
    try {
      const result = await uploadImageAsset(brandId, file, { tags: ["element"] });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const refreshed = await getBrandElementAssetsAction(brandId);
      setElements(refreshed);
    } finally {
      setElementsUploading(false);
    }
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

  /** Finishes a drag-to-draw gesture from the "Vùng tạo ảnh AI" tool —
   * creates the empty frame (no image yet) at the drawn artboard-space
   * rect, selects it, and switches back to the normal select tool so the
   * next mouse drag on canvas doesn't immediately start another region. */
  function handleCreateAiRegion(rect: { x: number; y: number; width: number; height: number }) {
    const layer: ResolvedLayer = {
      id: newLayerId(),
      type: "ai-region",
      x: rect.x,
      y: rect.y,
      width: Math.max(16, rect.width),
      height: Math.max(16, rect.height),
      rotation: 0,
      zIndex: Math.max(0, ...layers.map((l) => l.zIndex)) + 1,
    };
    pushHistory([...layers, layer]);
    setSelectedId(layer.id);
    setActiveTool("select");
    // Brand-new region — starts from a clean slate, never inheriting
    // whatever Reference/model/resolution happened to be set for a
    // DIFFERENT region selected earlier in this session.
    setRegionModel(AUTO_MODEL_ID);
    setRegionResolution("1k");
    setRegionReferences([]);
  }

  // Mirrors image-composer.tsx's own applyModelChangeSideEffects — a
  // model switch that drops to a lower (or zero) reference-image cap must
  // actually trim the extra slots, never silently send more images than
  // the newly-selected model's real API accepts.
  function handleRegionModelChange(nextModel: string) {
    const nextMeta = models.find((m) => m.id === nextModel);
    const nextMax = nextModel === AUTO_MODEL_ID ? 1 : (nextMeta?.maxReferenceImages ?? 0);
    const trimmedRefs = regionReferences.length > nextMax ? regionReferences.slice(0, nextMax) : regionReferences;
    setRegionReferences(trimmedRefs);
    setRegionModel(nextModel);
    if (selectedLayer) {
      updateLayer(selectedLayer.id, {
        aiModel: nextModel,
        aiReferenceImagePaths: trimmedRefs.map((r) => r.path).filter((p): p is string => Boolean(p)),
      });
    }
  }

  function handleRegionResolutionChange(next: RegionResolution) {
    setRegionResolution(next);
    if (selectedLayer) updateLayer(selectedLayer.id, { aiResolution: next });
  }

  function handleRegionReferencesChange(next: ReferenceImage[]) {
    setRegionReferences(next);
    if (selectedLayer) {
      updateLayer(selectedLayer.id, { aiReferenceImagePaths: next.map((r) => r.path).filter((p): p is string => Boolean(p)) });
    }
  }

  /** Generates an image for the currently-selected ai-region layer.
   *
   * IMPORTANT, honest limitation: no provider this app integrates with
   * (see providers/*.ts) supports real inpainting/mask-scoped generation
   * — there is no "only draw inside this rectangle of the existing
   * canvas" API call to make. This requests a plain image at (as close
   * as the chosen model supports to) the region's own pixel size, then
   * relies entirely on the EXISTING client-side cover-fit crop (same
   * computeCoverCrop the background layer already uses, see canvas.tsx)
   * to keep it visually confined to the region's box — the model itself
   * never sees or respects the region's boundary or whatever is behind
   * it on the canvas. */
  async function handleGenerateAiRegionImage() {
    if (!selectedLayer || selectedLayer.type !== "ai-region" || regionGenerating) return;
    const prompt = (selectedLayer.aiPrompt ?? "").trim();
    if (!prompt) return;
    const regionId = selectedLayer.id;
    setRegionGenerating(true);
    setRegionStatus("Đang gửi yêu cầu...");
    try {
      // Marketing Studio's real API takes aspect_ratio + a resolution tier,
      // never literal pixels (confirmed live — see marketing-studio-
      // provider.ts) — picks the nearest of its 8 discrete ratios to the
      // region's OWN drawn box so the result needs the least cover-fit
      // crop. Every other model keeps sending exactSize exactly as
      // before (unchanged behavior — these models' real APIs DO accept/
      // snap arbitrary pixel sizes, see higgsfield-provider.ts).
      const isMarketingStudioRegion = regionModel === MARKETING_STUDIO_MODEL_ID;
      const sizeFields = isMarketingStudioRegion
        ? { aspectRatio: nearestRegionAspectRatio(selectedLayer.width, selectedLayer.height), resolution: regionResolution }
        : {
            exactSize: {
              width: Math.max(1, Math.round(selectedLayer.width)),
              height: Math.max(1, Math.round(selectedLayer.height)),
            },
          };
      const referenceFields = isMarketingStudioRegion
        ? { referenceImageUrls: regionReferences.map((r) => r.url) }
        : { referenceImageUrl: regionReferences[0]?.url };
      const result = await generateImages({
        brandId,
        prompt,
        negativePrompt: "",
        count: 1,
        model: regionModel,
        ...sizeFields,
        ...referenceFields,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      let job: GenerationJob | null = null;
      for (let i = 0; i < AI_REGION_POLL_MAX_ATTEMPTS; i++) {
        job = await getGenerationJobAction(result.data.jobId);
        if (job && (job.status === "succeeded" || job.status === "failed")) break;
        if (job) {
          const last = job.attempts.at(-1);
          setRegionStatus(last?.status === "started" ? `Đang tạo bằng ${last.model}…` : "Đang tạo ảnh...");
        }
        await new Promise((resolve) => setTimeout(resolve, AI_REGION_POLL_INTERVAL_MS));
      }

      if (!job || job.status !== "succeeded" || !job.results[0]) {
        toast.error(job?.error || "Không thể tạo ảnh lúc này. Vui lòng thử lại.");
        return;
      }

      const saved = await saveGenerationResult({ jobId: job.id, outputIndex: 0, name: prompt.slice(0, 80) });
      if (!saved.ok) {
        toast.error(saved.error.message);
        return;
      }
      const signedUrl = await resolveAssetAsReference(saved.data.assetId);
      if (!signedUrl.ok) {
        toast.error(signedUrl.error.message);
        return;
      }
      // The region may have been resized/deselected while this request was
      // in flight — always patch by the id captured at request time, never
      // "whatever is selected now".
      updateLayer(regionId, {
        imagePath: saved.data.path,
        imageUrl: signedUrl.data.url,
        focalX: 0.5,
        focalY: 0.5,
      });
      toast.success("Đã tạo ảnh trong vùng đã chọn.");
    } finally {
      setRegionGenerating(false);
      setRegionStatus(null);
    }
  }

  /** Switches the active size preset in-editor — no round trip to the
   * setup step. The background layer's imagePath is never touched (same
   * master image reused, only its destination box + live cover-fit crop
   * change — see canvas.tsx), while every other layer's position/size is
   * either restored from a previously-visited variant (exact, including
   * any manual tweaks) or proportionally derived from the layout the
   * user is leaving (scaleLayersToSize) the first time this size is
   * visited. Never fires a new generation request. */
  function handleChangeSize(newPresetId: string) {
    const target = presets.find((p) => p.id === newPresetId);
    if (!target || target.id === size.id) return;

    const updatedVariants = { ...sizeVariants, [size.id ?? "__unset__"]: layers };
    const nextLayers = updatedVariants[target.id] ?? scaleLayersToSize(layers, size.width, size.height, target.width, target.height, guideline?.safeZone);

    setSizeVariants({ ...updatedVariants, [target.id]: nextLayers });
    setSize({ id: target.id, name: target.name, width: target.width, height: target.height });
    setSelectedId(null);
    pushHistory(nextLayers);
  }

  /** Switches which brand this banner belongs to — persists via
   * changeBannerBrand (updates creative_assets.brand_id/
   * guideline_version_id only, never the saved layers) then swaps the
   * local guideline so new text/logo picks use the new brand's
   * colors/logos immediately. A brand-new banner with no logo layer yet
   * gets the new brand's default logo placed automatically (PRD: "banner
   * mới, chọn thương hiệu sẽ cấu hình logo mặc định"); a banner that
   * already has a logo layer keeps it exactly as-is — switching brand
   * never silently replaces or deletes an existing logo/text layer (PRD:
   * "không âm thầm ghi đè... chỉnh sửa thủ công"), the user can still pick
   * the new brand's logo explicitly from the Logo panel below. */
  async function handleChangeBrand(newBrandId: string) {
    if (!newBrandId || newBrandId === brandId || isBrandChanging) return;
    setIsBrandChanging(true);
    try {
      const result = await changeBannerBrand({ assetId, brandId: newBrandId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setBrandId(newBrandId);
      setBrandName(result.data.brandName);
      setGuideline(result.data.guideline);

      const hasLogoLayer = layers.some((l) => l.type === "logo");
      const newLogo = result.data.guideline?.logos;
      if (!hasLogoLayer && newLogo?.primaryPath && newLogo.primaryUrl) {
        await applyLogoVariant("color", newLogo.primaryPath, newLogo.primaryUrl);
        toast.success(`Đã đổi sang thương hiệu "${result.data.brandName}" — đã thêm logo mặc định.`);
      } else {
        toast.success(
          `Đã đổi sang thương hiệu "${result.data.brandName}". Logo/nội dung đã có trên banner được giữ nguyên — có thể đổi logo thủ công ở mục "Logo thương hiệu".`
        );
      }
    } finally {
      setIsBrandChanging(false);
    }
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
        { id: newLayerId(), type: "background", x: 0, y: 0, width: size.width, height: size.height, rotation: 0, zIndex: 0, imagePath: path, imageUrl: url },
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
    if (!size.id) {
      toast.error("Chưa chọn kích thước banner.");
      return null;
    }
    const result = await saveDesignDocument({
      assetId,
      layers,
      sizePresetId: size.id,
      width: size.width,
      height: size.height,
      sizeVariants: { ...sizeVariants, [size.id]: layers },
    });
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
  }, [assetId, layers, router, results, size.id, size.width, size.height, sizeVariants]);

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

      // Deselect synchronously before rasterizing — the Transformer's
      // selection outline/resize handles live in the SAME Konva Layer as
      // every real layer, so without this they'd be baked straight into
      // the exported file whenever something happens to be selected (this
      // was already true for every layer type, not just the new ai-region
      // frame — fixed at the root here rather than special-cased per
      // layer). flushSync forces the deselect to actually re-render and
      // redraw the stage before toDataURL reads its pixels; a plain
      // setState wouldn't apply in time since toDataURL is synchronous.
      const selectionBeforeExport = selectedId;
      flushSync(() => setSelectedId(null));
      // Native resolution regardless of on-screen display scale.
      const pixelRatio = 1 / displayScale;
      const dataUrl = stage.toDataURL({
        mimeType: exportFormat === "png" ? "image/png" : "image/jpeg",
        quality: 0.92,
        pixelRatio,
      });
      flushSync(() => setSelectedId(selectionBeforeExport));
      const res = await fetch(dataUrl);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const result = await exportDesign(
        { assetId, designDocumentId: exportDocumentId, format: exportFormat, width: size.width, height: size.height },
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
        a.download = buildExportFilename(brandName, bannerName, size.name, exportVersion, exportFormat);
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
        <div className="flex items-center gap-1.5">
          {editingName ? (
            <>
              <Input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitNameEdit();
                  if (e.key === "Escape") {
                    setNameDraft(bannerName);
                    setEditingName(false);
                  }
                }}
                onBlur={() => void commitNameEdit()}
                maxLength={200}
                disabled={savingName}
                className="h-8 max-w-xs font-heading text-base font-semibold"
              />
              {savingName && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(bannerName);
                setEditingName(true);
              }}
              className="group -ml-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-accent/50"
            >
              <h1 className="font-heading truncate text-base font-semibold">{bannerName || "Banner chưa đặt tên"}</h1>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
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
              aiRegionToolActive={activeTool === "ai-region"}
              onToggleAiRegionTool={() => setActiveTool((t) => (t === "ai-region" ? "select" : "ai-region"))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!backgroundLayer?.imageUrl}
              title={!backgroundLayer?.imageUrl ? "Cần có ảnh nền trước khi tạo hình ảnh bằng AI" : undefined}
              onClick={() => setAiPanelOpen(true)}
            >
              <Sparkles className="size-3.5" />
              Tạo hình ảnh bằng AI
            </Button>
            <Button size="sm" variant="outline" disabled={isDuplicating} onClick={handleDuplicate}>
              {isDuplicating ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
              Nhân bản
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdaptDialogOpen(true)}>
              <LayoutGrid className="size-3.5" />
              Tạo phiên bản kích thước khác
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

        {!backgroundLayer?.imageUrl && (
          <p className="text-xs text-muted-foreground">
            Canvas chưa có ảnh nền — bấm biểu tượng ảnh trên thanh công cụ để chọn ảnh có sẵn hoặc tải lên, hoặc dùng
            &quot;Tạo hình ảnh bằng AI&quot; sau khi có nền.
          </p>
        )}

        {activeTool === "ai-region" && (
          <p className="text-xs text-primary">Kéo một khung trên canvas để tạo vùng tạo ảnh AI mới.</p>
        )}

        <div className="overflow-auto rounded-lg border bg-muted/30 p-4 flex items-center justify-center">
          <EditorCanvas
            layers={layers}
            width={size.width}
            height={size.height}
            displayScale={displayScale}
            selectedId={selectedId}
            onSelect={selectLayer}
            onChangeLayer={updateLayer}
            drawingAiRegion={activeTool === "ai-region"}
            onDrawAiRegion={handleCreateAiRegion}
            showGrid={showGrid}
            showSafeZone={showSafeZone}
            safeZone={guideline?.safeZone ?? {}}
            stageRef={stageRef}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full lg:w-80 shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto lg:pr-1 lg:pb-2">
        <CollapsibleCard
          title="Thiết lập banner"
          description={`${brandName}${size.name ? ` · ${size.name} (${size.width} × ${size.height} px)` : ""}`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Thương hiệu</Label>
              <BrandPicker brands={brands} value={brandId} onChange={handleChangeBrand} />
              {isBrandChanging && <p className="text-xs text-muted-foreground">Đang đổi thương hiệu...</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Kích thước</Label>
              <SizePresetCards presets={presets} value={size.id ?? ""} onChange={handleChangeSize} />
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="Phiên bản kích thước"
          description={`${familyMembers.length} phiên bản`}
          badge={
            familyMembers.some((m) => m.needsReview) ? (
              <span className="text-xs font-medium text-warning">Cần kiểm tra</span>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-2">
            {familyMembers.length <= 1 && (
              <p className="text-xs text-muted-foreground">
                Chưa có phiên bản kích thước nào khác — bấm &quot;Tạo phiên bản kích thước khác&quot; ở thanh công cụ
                phía trên để adapt thiết kế này sang các preset khác.
              </p>
            )}
            <BannerVariantsPanel
              rootId={familyRootId}
              currentAssetId={assetId}
              members={familyMembers}
              brandName={brandName}
              exportFormat={exportFormat}
              onRefresh={refreshFamily}
            />
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Lớp" badge={<span className="text-xs text-muted-foreground">{layers.length}</span>}>
          <LayerPanel
            layers={layers}
            selectedId={selectedId}
            onSelect={selectLayer}
            onToggleLock={handleToggleLock}
            onToggleVisible={handleToggleVisible}
            onDelete={handleDeleteLayer}
            onReorder={handleReorder}
          />
        </CollapsibleCard>

        {guideline && (
          <CollapsibleCard title="Logo thương hiệu" defaultOpen={false}>
            <LogoPanel logos={guideline.logos} activePath={layers.find((l) => l.type === "logo")?.imagePath} onSelect={applyLogoVariant} />
          </CollapsibleCard>
        )}

        <CollapsibleCard title="Nội dung chữ">
          <TextContentPanel
            taglineText={taglineLayer?.text ?? ""}
            subtitleText={subtitleLayer?.text ?? ""}
            taglineExists={Boolean(taglineLayer)}
            subtitleExists={Boolean(subtitleLayer)}
            taglineAlign={taglineLayer?.align ?? "left"}
            taglineColor={taglineLayer?.color ?? "#ffffff"}
            subtitleAlign={subtitleLayer?.align ?? "left"}
            subtitleColor={subtitleLayer?.color ?? "#ffffff"}
            onChangeTagline={(text) => handleTextContentChange("tagline", text)}
            onChangeSubtitle={(text) => handleTextContentChange("subtitle", text)}
            onChangeTaglineAlign={(align) => taglineLayer && updateLayer(taglineLayer.id, { align })}
            onChangeTaglineColor={(color) => taglineLayer && updateLayer(taglineLayer.id, { color })}
            onChangeSubtitleAlign={(align) => subtitleLayer && updateLayer(subtitleLayer.id, { align })}
            onChangeSubtitleColor={(color) => subtitleLayer && updateLayer(subtitleLayer.id, { color })}
            onSelectTagline={() => taglineLayer && selectLayer(taglineLayer.id)}
            onSelectSubtitle={() => subtitleLayer && selectLayer(subtitleLayer.id)}
            guidelineColors={guideline?.colors}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Elements"
          description="Hình trang trí từ thư viện của thương hiệu — bấm để thêm vào banner."
          defaultOpen={false}
        >
          <ElementsPanel
            elements={elements}
            loading={elementsLoading}
            uploading={elementsUploading}
            onSelect={handleAddElement}
            onUpload={handleUploadElement}
          />
        </CollapsibleCard>

        {selectedLayer?.type === "text" && (
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle className="text-sm">Thuộc tính chữ</CardTitle>
            </CardHeader>
            <CardContent>
              <TextProperties
                layer={selectedLayer}
                onChange={(patch) => updateLayer(selectedLayer.id, patch)}
                guidelineColors={guideline?.colors}
              />
            </CardContent>
          </Card>
        )}

        {selectedLayer?.type === "background" && selectedLayer.imageUrl && (
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle className="text-sm">Vị trí ảnh nền</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Ảnh nền tự động lấp đầy khung theo đúng tỉ lệ gốc (không méo, không kéo giãn) — kéo thanh trượt để chọn
                phần ảnh hiển thị khi phần dư bị cắt ở hai bên.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Ngang</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedLayer.focalX ?? 0.5}
                  onChange={(e) => updateLayer(selectedLayer.id, { focalX: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Dọc</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedLayer.focalY ?? 0.5}
                  onChange={(e) => updateLayer(selectedLayer.id, { focalY: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {selectedLayer?.type === "image" && selectedLayer.featherPx !== undefined && (
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle className="text-sm">Thuộc tính ảnh AI</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageProperties layer={selectedLayer} onChange={(patch) => updateLayer(selectedLayer.id, patch)} />
            </CardContent>
          </Card>
        )}

        {selectedLayer?.type === "ai-region" && (
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle className="text-sm">Vùng tạo ảnh AI</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Vùng {Math.round(selectedLayer.width)}×{Math.round(selectedLayer.height)} px. Ảnh được tạo sẽ fit/crop
                vừa khít vùng này, không tràn ra ngoài — model hiện chưa hỗ trợ giới hạn vùng tạo ảnh theo mask thật
                (inpainting), app chỉ fit/crop kết quả sau khi tạo.
              </p>
              <Textarea
                value={selectedLayer.aiPrompt ?? ""}
                onChange={(e) => updateLayer(selectedLayer.id, { aiPrompt: e.target.value })}
                placeholder="Mô tả ảnh muốn tạo trong vùng này..."
                rows={4}
                maxLength={regionMaxPromptLength}
                aria-invalid={regionPromptOverLimit}
                disabled={regionGenerating}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {regionPromptOverLimit
                    ? `Vượt giới hạn — tối đa ${regionMaxPromptLength.toLocaleString("vi-VN")} ký tự.`
                    : " "}
                </p>
                <CharCounter current={(selectedLayer.aiPrompt ?? "").length} max={regionMaxPromptLength} />
              </div>

              <ReferencePicker
                values={regionReferences}
                onChange={handleRegionReferencesChange}
                elements={referenceAssets}
                max={regionMaxReferenceImages}
                disabled={regionMaxReferenceImages === 0 || regionGenerating}
                disabledReason="Model đang chọn chưa xác nhận hỗ trợ ảnh tham chiếu."
              />

              <ModelPicker models={models} value={regionModel} onChange={handleRegionModelChange} />

              {isRegionMarketingStudio && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Độ phân giải</Label>
                  <div className="flex gap-1.5">
                    {REGION_RESOLUTIONS.map((r) => (
                      <Button
                        key={r}
                        type="button"
                        size="sm"
                        variant={regionResolution === r ? "secondary" : "outline"}
                        disabled={regionGenerating}
                        onClick={() => handleRegionResolutionChange(r)}
                        className="uppercase"
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marketing Studio dùng tỷ lệ khung hình + độ phân giải thay vì kích thước pixel — tỷ lệ gần nhất với
                    vùng đã vẽ được tự chọn ({nearestRegionAspectRatio(selectedLayer.width, selectedLayer.height)}).
                  </p>
                </div>
              )}

              <Button
                type="button"
                size="sm"
                disabled={regionGenerating || !(selectedLayer.aiPrompt ?? "").trim() || regionPromptOverLimit}
                onClick={handleGenerateAiRegionImage}
              >
                {regionGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {regionGenerating ? "Đang tạo..." : selectedLayer.imageUrl ? "Tạo lại ảnh" : "Tạo ảnh"}
              </Button>
              {regionGenerating && regionStatus && <p className="text-xs text-muted-foreground">{regionStatus}</p>}

              {selectedLayer.imageUrl && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Feather viền</Label>
                      <span className="text-xs tabular-nums text-muted-foreground">{selectedLayer.featherPx ?? 0}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={48}
                      step={1}
                      value={selectedLayer.featherPx ?? 0}
                      onChange={(e) => updateLayer(selectedLayer.id, { featherPx: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Vị trí crop — Ngang</Label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedLayer.focalX ?? 0.5}
                      onChange={(e) => updateLayer(selectedLayer.id, { focalX: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Vị trí crop — Dọc</Label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedLayer.focalY ?? 0.5}
                      onChange={(e) => updateLayer(selectedLayer.id, { focalY: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                </>
              )}

              <Button type="button" size="sm" variant="outline" onClick={() => handleDeleteLayer(selectedLayer.id)}>
                <Trash2 className="size-3.5" />
                Xoá vùng
              </Button>
            </CardContent>
          </Card>
        )}

        <CollapsibleCard
          title="Kiểm tra guideline"
          badge={
            blocked ? (
              <span className="text-xs font-medium text-destructive">Có lỗi</span>
            ) : results.some((r) => r.severity === "review") ? (
              <span className="text-xs font-medium text-warning">Cần xem</span>
            ) : (
              <span className="text-xs font-medium text-success">Ổn</span>
            )
          }
        >
          <GuidelinePanel results={results} />
        </CollapsibleCard>
      </div>

      {backgroundLayer?.imageUrl && (
        <AiImagePanel
          open={aiPanelOpen}
          onOpenChange={setAiPanelOpen}
          brandId={brandId}
          backgroundImageUrl={backgroundLayer.imageUrl}
          models={models}
          onConfirm={handlePlaceAiImage}
        />
      )}

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

      <AdaptSizesDialog
        open={adaptDialogOpen}
        onOpenChange={setAdaptDialogOpen}
        sourceAssetId={assetId}
        currentSizePresetId={size.id}
        presets={presets}
        existingVariantPresetIds={familyMembers.filter((m) => !m.isOriginal && m.sizePresetId).map((m) => m.sizePresetId as string)}
        onDone={refreshFamily}
      />
    </div>
  );
}
