"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  Upload,
  Lock,
  Plus,
  Minus,
  UserRound,
  Image as ImageIconLucide,
  Pencil,
  Trash2,
  Maximize2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Shirt,
  ScanFace,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { SizePresetPicker } from "@/components/brand/size-preset-picker";
import { DownloadAssetButton } from "@/components/library/download-asset-button";
import { ModelPicker } from "./model-picker";
import { CharCounter } from "./char-counter";
import { getGenerationJobAction, saveGenerationResult, uploadReferenceImage } from "@/lib/generation/actions";
import {
  createCharacter,
  createCharacterSheet,
  deleteCharacterSheet,
  generateCharacterFace,
  getCharacterSheetsAction,
  renameCharacter,
  uploadCharacterFace,
} from "@/lib/generation/character-actions";
import { CHARACTER_STYLE_PRESETS, DEFAULT_CHARACTER_STYLE, characterStyleLabel, type CharacterStyleId } from "@/lib/generation/character-style";
import { AUTO_MODEL_ID, modelLabel, type ModelMeta } from "@/lib/generation/model-meta";
import {
  CHARACTER_ETHNICITY_LABEL,
  CHARACTER_GENDER_LABEL,
  CHARACTER_VIEWS,
  CHARACTER_VIEW_LABEL,
  CHARACTER_MIN_AGE,
  CHARACTER_MAX_AGE,
  CHARACTER_DEFAULT_AGE,
} from "@/types/character";
import type {
  Character,
  CharacterEthnicity,
  CharacterGender,
  CharacterSheet,
  CharacterSheetViewItem,
  CharacterFaceSource,
} from "@/types/character";
import type { SizePreset } from "@/types/brand";

const HIGGSFIELD_MODEL_ID = "higgsfield-soul2";
// The only model in this app whose adapter accepts a SECOND reference
// image (see providers/marketing-studio-provider.ts, which reads
// `referenceImageUrls`) — an outfit reference image only ever actually
// reaches the request when this exact model is selected (mirrors the
// same constant/condition in character-actions.ts's createCharacterSheet).
const MARKETING_STUDIO_MODEL_ID = "higgsfield-marketing-studio";
const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_ATTEMPTS = 100; // ~150s, same margin as ImageComposer
const MAX_APPEARANCE_LENGTH = 600;
const MAX_OUTFIT_LENGTH = 400;
const MAX_STYLE_LENGTH = 200;
const MAX_NEGATIVE_PROMPT_LENGTH = 500;
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const MAX_OUTFITS = 5;
const TAG_REGEX = /^[a-zA-Z0-9_.]+$/;
const ETHNICITY_OPTIONS: CharacterEthnicity[] = ["vietnamese", "asian", "european"];
const DEFAULT_ETHNICITY: CharacterEthnicity = "vietnamese";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Short, human-scannable id from a Storage path or job id — never the
 * full UUID (no need, and it would wrap awkwardly in the compact face
 * preview card). Purely a display convenience, never used as a lookup key. */
function shortId(value: string): string {
  const base = value.split("/").pop() ?? value;
  const withoutExt = base.split(".")[0];
  return withoutExt.length > 13 ? `${withoutExt.slice(0, 13)}...` : withoutExt;
}

interface UploadedFace {
  path: string;
  url: string;
  fileName: string;
}

interface AiFacePreview {
  jobId: string;
  outputIndex: number;
  url: string;
  isDemo: boolean;
}

interface OutfitReferenceImage {
  url: string;
  fileName: string;
}

interface OutfitEntry {
  id: string;
  label: string;
  description: string;
  referenceImage: OutfitReferenceImage | null;
}

function SectionHeading({
  step,
  title,
  summary,
  icon: Icon,
}: {
  step: number;
  title: string;
  summary?: string;
  icon?: LucideIcon;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
        {step}
      </span>
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="flex min-w-0 items-baseline gap-1">
        <span className="text-sm font-semibold">{title}</span>
        {summary && <span className="truncate text-xs text-muted-foreground">· {summary}</span>}
      </span>
    </span>
  );
}

/** Small uppercase, letter-spaced field label — used for the "Khuôn mặt"
 * group's sub-sections (Nguồn khuôn mặt / Xuất thân-dân tộc) to visually
 * separate them from the section header above, mirroring the reference
 * mock's typographic hierarchy without copying its exact chrome. */
function FieldLabel({ children }: { children: ReactNode }) {
  return <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</Label>;
}

function truncateLabel(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function aspectRatioLabel(width: number, height: number): string {
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}

/** Bounded, aspect-ratio-correct image — never stretches/crops: the
 * wrapper's own aspect-ratio matches the real output size once known
 * (object-contain inside it never needs to crop), and falls back to a
 * neutral square only while the size isn't known yet (loading). */
function FitImage({ src, alt, width, height }: { src: string; alt: string; width: number | null; height: number | null }) {
  return (
    <div
      className="flex size-full items-center justify-center overflow-hidden bg-muted/40"
      style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function CharacterBuilder({
  brandId,
  presets,
  models,
  initialCharacters,
}: {
  brandId: string | null;
  presets: SizePreset[];
  /** Server-resolved CONFIGURED models only — see create/image/page.tsx. */
  models: ModelMeta[];
  initialCharacters: Character[];
}) {
  const router = useRouter();
  // Characters created THIS session, before router.refresh() has brought
  // them back down through `initialCharacters` — merged in front of the
  // server list and de-duped by id once the server list catches up, so
  // the UI never waits a round-trip to show a just-created character.
  const [optimisticCharacters, setOptimisticCharacters] = useState<Character[]>([]);
  const characters = useMemo(() => {
    const serverIds = new Set(initialCharacters.map((c) => c.id));
    return [...optimisticCharacters.filter((c) => !serverIds.has(c.id)), ...initialCharacters];
  }, [initialCharacters, optimisticCharacters]);

  const [selectedId, setSelectedId] = useState<string | null>(initialCharacters[0]?.id ?? null);
  const isNew = selectedId === null;
  const selectedCharacter = characters.find((c) => c.id === selectedId) ?? null;

  // Step 1 — Nhân vật (gender + age are both locked identity traits, same
  // as ethnicity below — see resetFaceState's comment)
  const [displayName, setDisplayName] = useState("");
  const [tagName, setTagName] = useState("");
  const [gender, setGender] = useState<CharacterGender>("female");
  const [age, setAge] = useState(CHARACTER_DEFAULT_AGE);

  // Step 2 — Khuôn mặt — Nguồn khuôn mặt + Xuất thân/dân tộc
  // (locked identity traits, same as gender/age — kept alongside the face
  // controls per the product's own grouping, not under "Ngoại hình", which
  // holds re-editable PER-SHEET generation params instead).
  const [faceSource, setFaceSource] = useState<CharacterFaceSource>("upload");
  const [ethnicity, setEthnicity] = useState<CharacterEthnicity>(DEFAULT_ETHNICITY);
  const [uploadedFace, setUploadedFace] = useState<UploadedFace | null>(null);
  const [uploading, setUploading] = useState(false);
  const [faceUploadError, setFaceUploadError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [aiFacePreview, setAiFacePreview] = useState<AiFacePreview | null>(null);
  const [generatingFace, setGeneratingFace] = useState(false);

  // Step 3 — Phong cách (generation parameters — apply to whichever
  // character is active, new or existing, and survive regenerating)
  const [style, setStyle] = useState<CharacterStyleId>(DEFAULT_CHARACTER_STYLE);
  const [customStyle, setCustomStyle] = useState("");

  // Step 4 — Ngoại hình
  const [appearanceDescription, setAppearanceDescription] = useState("");
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");

  // Step 5 — Trang phục (0+ named outfit sets, one active per generation)
  const [outfits, setOutfits] = useState<OutfitEntry[]>([]);
  const [activeOutfitId, setActiveOutfitId] = useState<string | null>(null);
  const [uploadingOutfitId, setUploadingOutfitId] = useState<string | null>(null);

  // Step 6 — Khung ảnh
  const [sizePresetId, setSizePresetId] = useState<string>(presets[0]?.id ?? "");

  // Số ảnh + Mô hình AI
  const defaultModel = models.find((m) => m.id === HIGGSFIELD_MODEL_ID)?.id ?? models[0]?.id ?? AUTO_MODEL_ID;
  const [count, setCount] = useState("2");
  const [model, setModel] = useState<string>(defaultModel);

  const [working, setWorking] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const [sheets, setSheets] = useState<CharacterSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<CharacterSheet | null>(null);
  const [sheetsStatus, setSheetsStatus] = useState<"idle" | "loading" | "error">(
    initialCharacters[0] ? "loading" : "idle"
  );

  // Rename
  const [renaming, setRenaming] = useState(false);
  const [renameDisplayName, setRenameDisplayName] = useState("");
  const [renameTagName, setRenameTagName] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Delete confirm + viewer dialog
  const [sheetPendingDelete, setSheetPendingDelete] = useState<CharacterSheet | null>(null);
  const [deletingSheet, setDeletingSheet] = useState(false);
  const [viewerItem, setViewerItem] = useState<CharacterSheetViewItem | null>(null);

  async function loadSheets(characterId: string) {
    setSheetsStatus("loading");
    const result = await getCharacterSheetsAction(characterId);
    if (!result.ok) {
      setSheetsStatus("error");
      return;
    }
    setSheets(result.data);
    setActiveSheet(result.data[0] ?? null);
    setSheetsStatus("idle");
  }

  const selectedPreset = presets.find((p) => p.id === sizePresetId);
  const selectedModelMeta = models.find((m) => m.id === model);
  const modelSupportsFaceReference = (selectedModelMeta?.maxReferenceImages ?? (model === AUTO_MODEL_ID ? 1 : 0)) >= 1;
  const isMarketingStudioSelected = model === MARKETING_STUDIO_MODEL_ID;
  const appearanceOverLimit = appearanceDescription.length > MAX_APPEARANCE_LENGTH;
  const negativePromptOverLimit = negativePrompt.length > MAX_NEGATIVE_PROMPT_LENGTH;
  const activeOutfit = outfits.find((o) => o.id === activeOutfitId) ?? null;

  const styleSummary =
    style === "custom"
      ? customStyle.trim()
        ? `Tùy chỉnh — ${truncateLabel(customStyle, 24)}`
        : "Tùy chỉnh"
      : characterStyleLabel(style);
  const appearanceSummary = appearanceDescription.trim() ? truncateLabel(appearanceDescription, 28) : "Mặc định";
  const outfitSummary =
    outfits.length === 0 ? "Chưa có bộ nào" : `${outfits.length} bộ${activeOutfit ? ` · đang dùng ${activeOutfit.label}` : ""}`;
  const sizeSummary = selectedPreset
    ? `${aspectRatioLabel(selectedPreset.width, selectedPreset.height)} · ${selectedPreset.width}×${selectedPreset.height}px`
    : "Chưa chọn";

  const tagTrimmed = tagName.trim();
  const tagDuplicate =
    isNew && tagTrimmed.length > 0 && characters.some((c) => c.tagName.toLowerCase() === tagTrimmed.toLowerCase());
  const tagInvalidChars = tagTrimmed.length > 0 && !TAG_REGEX.test(tagTrimmed);
  const tagError = tagDuplicate
    ? `Tag "@${tagTrimmed}" đã được dùng trong workspace này.`
    : tagInvalidChars
      ? "Tag chỉ gồm chữ, số, dấu chấm và gạch dưới."
      : null;

  function resetFaceState() {
    setFaceSource("upload");
    setEthnicity(DEFAULT_ETHNICITY);
    setUploadedFace(null);
    setFaceUploadError(null);
    setConsent(false);
    setAiFacePreview(null);
  }

  function startNewCharacter() {
    setSelectedId(null);
    setSheets([]);
    setActiveSheet(null);
    setSheetsStatus("idle");
    setRenaming(false);
    setDisplayName("");
    setTagName("");
    setGender("female");
    setAge(CHARACTER_DEFAULT_AGE);
    resetFaceState();
  }

  function selectCharacter(id: string) {
    setSelectedId(id);
    setSheets([]);
    setActiveSheet(null);
    setRenaming(false);
    void loadSheets(id);
  }

  async function handleUploadFace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFaceUploadError(null);
    if (file.size > UPLOAD_MAX_BYTES) {
      setFaceUploadError("File quá lớn. Tối đa 10MB.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadCharacterFace(file);
      if (!result.ok) {
        setFaceUploadError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setUploadedFace({ path: result.data.path, url: result.data.url, fileName: file.name });
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadOutfitImage(outfitId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > UPLOAD_MAX_BYTES) {
      toast.error("File quá lớn. Tối đa 10MB.");
      return;
    }
    setUploadingOutfitId(outfitId);
    try {
      const result = await uploadReferenceImage(file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOutfits((prev) =>
        prev.map((o) => (o.id === outfitId ? { ...o, referenceImage: { url: result.data.url, fileName: file.name } } : o))
      );
    } finally {
      setUploadingOutfitId(null);
    }
  }

  function addOutfit() {
    if (outfits.length >= MAX_OUTFITS) return;
    const id = crypto.randomUUID();
    const entry: OutfitEntry = { id, label: `Bộ ${outfits.length + 1}`, description: "", referenceImage: null };
    setOutfits((prev) => [...prev, entry]);
    setActiveOutfitId(id);
  }

  function updateOutfit(id: string, patch: Partial<Pick<OutfitEntry, "description" | "referenceImage">>) {
    setOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function removeOutfit(id: string) {
    setOutfits((prev) => prev.filter((o) => o.id !== id));
    setActiveOutfitId((prev) => (prev === id ? null : prev));
  }

  async function handleGenerateAiFace() {
    if (!brandId || !sizePresetId || generatingFace) return;
    setGeneratingFace(true);
    setAiFacePreview(null);
    setStatusText("Đang tạo khuôn mặt bằng AI...");
    try {
      const result = await generateCharacterFace({
        brandId,
        gender,
        ethnicity,
        age,
        style,
        customStyle,
        appearanceDescription,
        model,
        sizePresetId,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      let job = null;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        job = await getGenerationJobAction(result.data.jobId);
        if (job && (job.status === "succeeded" || job.status === "failed")) break;
        await sleep(POLL_INTERVAL_MS);
      }
      if (!job || job.status !== "succeeded" || !job.results[0]?.url) {
        toast.error(job?.error || "Không thể tạo khuôn mặt lúc này. Thử lại hoặc tải ảnh lên thay thế.");
        return;
      }
      setAiFacePreview({ jobId: result.data.jobId, outputIndex: 0, url: job.results[0].url, isDemo: job.results[0].isDemo });
    } finally {
      setGeneratingFace(false);
      setStatusText(null);
    }
  }

  const faceReady = faceSource === "upload" ? Boolean(uploadedFace && consent) : Boolean(aiFacePreview);
  const canSubmit =
    Boolean(brandId) &&
    Boolean(sizePresetId) &&
    !appearanceOverLimit &&
    !negativePromptOverLimit &&
    (isNew ? tagTrimmed.length >= 2 && !tagError && faceReady : true) &&
    !working;

  async function handleGenerateSheet() {
    if (!canSubmit || !brandId) return;
    setWorking(true);
    try {
      let characterId = selectedId;

      if (isNew) {
        setStatusText("Đang khóa khuôn mặt...");
        const createInput =
          faceSource === "upload"
            ? {
                displayName,
                tagName: tagTrimmed,
                gender,
                ethnicity,
                age,
                faceSource,
                consentConfirmed: consent,
                faceStoragePath: uploadedFace!.path,
              }
            : {
                displayName,
                tagName: tagTrimmed,
                gender,
                ethnicity,
                age,
                faceSource,
                faceJobId: aiFacePreview!.jobId,
                faceOutputIndex: aiFacePreview!.outputIndex,
              };
        const createResult = await createCharacter(createInput);
        if (!createResult.ok) {
          toast.error(createResult.error.message);
          return;
        }
        characterId = createResult.data.characterId;
        const optimistic: Character = {
          id: characterId,
          workspaceId: "",
          displayName,
          tagName: tagTrimmed,
          gender,
          ethnicity,
          age,
          faceSource,
          faceUrl: faceSource === "upload" ? uploadedFace!.url : aiFacePreview!.url,
          faceLocked: true,
          consentConfirmed: faceSource === "upload" ? consent : false,
          createdAt: new Date().toISOString(),
        };
        setOptimisticCharacters((prev) => [optimistic, ...prev]);
        setSelectedId(characterId);
        router.refresh();
      }

      if (!characterId) return;

      setStatusText("Đang tạo bảng nhân vật...");
      const sheetResult = await createCharacterSheet({
        characterId,
        brandId,
        model,
        sizePresetId,
        count: Number(count),
        style,
        customStyle,
        appearanceDescription,
        outfitDescription: activeOutfit?.description ?? "",
        outfitReferenceImageUrl: activeOutfit?.referenceImage?.url,
        negativePrompt,
      });
      if (!sheetResult.ok) {
        toast.error(sheetResult.error.message);
        return;
      }
      if (activeOutfit?.referenceImage && !sheetResult.data.outfitImageSent) {
        toast.message(
          `Model "${modelLabel(model)}" chỉ nhận 1 ảnh tham chiếu (khuôn mặt) — ảnh trang phục của "${activeOutfit.label}" không được gửi, chỉ dùng mô tả văn bản.`
        );
      }

      const resolvedViews: CharacterSheetViewItem[] = [];
      for (const r of sheetResult.data.results) {
        if (!r.ok || !r.jobId) {
          resolvedViews.push({
            view: r.view,
            jobId: r.jobId ?? "",
            status: "failed",
            url: null,
            width: null,
            height: null,
            isDemo: false,
            savedAssetId: null,
            error: r.error,
            prompt: "",
            requestedModel: model,
            finalModel: null,
            attempts: [],
          });
          continue;
        }
        setStatusText(`Đang tạo góc ${CHARACTER_VIEW_LABEL[r.view]}...`);
        let job = null;
        for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
          job = await getGenerationJobAction(r.jobId);
          if (job && (job.status === "succeeded" || job.status === "failed")) break;
          await sleep(POLL_INTERVAL_MS);
        }
        let savedAssetId: string | null = job?.results[0]?.savedAssetId ?? null;
        if (job?.status === "succeeded" && job.results[0] && !job.results[0].isDemo && !savedAssetId) {
          const label = displayName || tagTrimmed || selectedCharacter?.displayName || selectedCharacter?.tagName || "nhân vật";
          const saveResult = await saveGenerationResult({
            jobId: r.jobId,
            outputIndex: 0,
            name: `${label} — ${CHARACTER_VIEW_LABEL[r.view]}`,
          });
          if (saveResult.ok) savedAssetId = saveResult.data.assetId;
        }
        resolvedViews.push({
          view: r.view,
          jobId: r.jobId,
          status: job?.status ?? "failed",
          url: job?.results[0]?.url ?? null,
          width: job?.results[0]?.width ?? null,
          height: job?.results[0]?.height ?? null,
          isDemo: job?.results[0]?.isDemo ?? false,
          savedAssetId,
          error: job?.error ?? null,
          prompt: job?.prompt ?? "",
          requestedModel: job?.requestedModel ?? model,
          finalModel: job?.finalModel ?? null,
          attempts: job?.attempts ?? [],
        });
      }

      const newSheet: CharacterSheet = {
        sheetId: sheetResult.data.sheetId,
        characterId,
        createdAt: new Date().toISOString(),
        views: resolvedViews,
      };
      setActiveSheet(newSheet);
      setSheets((prev) => [newSheet, ...prev]);

      const failedCount = resolvedViews.filter((v) => v.status !== "succeeded").length;
      if (failedCount === resolvedViews.length) {
        toast.error("Không thể tạo bảng nhân vật lúc này. Kiểm tra ghi chú lỗi trên từng ảnh bên dưới.");
      } else if (failedCount > 0) {
        toast.message(`Đã tạo ${resolvedViews.length - failedCount}/${resolvedViews.length} ảnh — một số góc bị lỗi.`);
      } else {
        toast.success(`Đã tạo bảng nhân vật (${resolvedViews.length} ảnh).`);
      }
    } finally {
      setWorking(false);
      setStatusText(null);
    }
  }

  function startRename() {
    if (!selectedCharacter) return;
    setRenameDisplayName(selectedCharacter.displayName);
    setRenameTagName(selectedCharacter.tagName);
    setRenaming(true);
  }

  async function handleSaveRename() {
    if (!selectedCharacter) return;
    const nextTag = renameTagName.trim();
    if (nextTag.length < 2 || !TAG_REGEX.test(nextTag)) {
      toast.error("Tag không hợp lệ — ít nhất 2 ký tự, chỉ gồm chữ, số, dấu chấm và gạch dưới.");
      return;
    }
    setSavingRename(true);
    try {
      const result = await renameCharacter({
        characterId: selectedCharacter.id,
        displayName: renameDisplayName,
        tagName: nextTag,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOptimisticCharacters((prev) => [
        { ...selectedCharacter, displayName: renameDisplayName, tagName: nextTag },
        ...prev.filter((c) => c.id !== selectedCharacter.id),
      ]);
      setRenaming(false);
      toast.success("Đã đổi tên nhân vật.");
      router.refresh();
    } finally {
      setSavingRename(false);
    }
  }

  async function handleConfirmDeleteSheet() {
    if (!sheetPendingDelete) return;
    setDeletingSheet(true);
    try {
      const result = await deleteCharacterSheet({ characterSheetId: sheetPendingDelete.sheetId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setSheets((prev) => prev.filter((s) => s.sheetId !== sheetPendingDelete.sheetId));
      setActiveSheet((prev) => (prev?.sheetId === sheetPendingDelete.sheetId ? null : prev));
      toast.success("Đã xoá bảng nhân vật.");
    } finally {
      setDeletingSheet(false);
      setSheetPendingDelete(null);
    }
  }

  const aspectLabel = selectedPreset ? `${selectedPreset.width}×${selectedPreset.height}` : "—";
  const summaryViews = CHARACTER_VIEWS.slice(0, Number(count))
    .map((v) => CHARACTER_VIEW_LABEL[v])
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      {/* Tóm tắt cấu hình hiện tại */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg ring-1 ring-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {isNew ? "Nhân vật mới" : `@${selectedCharacter?.tagName ?? "—"}`}
        </span>
        <span>·</span>
        <span>{CHARACTER_GENDER_LABEL[isNew ? gender : (selectedCharacter?.gender ?? "female")]}</span>
        <span>·</span>
        <span>{summaryViews || "Chưa chọn góc chụp"}</span>
        <span>·</span>
        <span>{styleSummary}</span>
        <span>·</span>
        <span>{aspectLabel}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
        {/* Left panel — character list + form, scrolls independently from the result panel on desktop */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
          {characters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={startNewCharacter}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  isNew ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Plus className="size-3" />
                Nhân vật mới
              </button>
              {characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCharacter(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedId === c.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="flex size-4 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {c.faceUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                      <img src={c.faceUrl} alt={c.tagName} className="size-full object-cover" />
                    ) : (
                      <UserRound className="size-2.5" />
                    )}
                  </span>
                  {c.displayName || `@${c.tagName}`}
                </button>
              ))}
            </div>
          )}

          {isNew ? (
            <>
              <Card className="p-0 overflow-visible">
                <Collapsible defaultOpen className="p-4 flex flex-col gap-3">
                  <CollapsibleTrigger>
                    <SectionHeading step={1} title="Nhân vật" />
                  </CollapsibleTrigger>
                  <CollapsiblePanel className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="character-name" className="text-xs text-muted-foreground">
                        Tên nhân vật (tuỳ chọn)
                      </Label>
                      <Input
                        id="character-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="VD: Cô gái áo denim"
                        maxLength={100}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="character-tag" className="text-xs text-muted-foreground">
                        Tag định danh (dùng để tham chiếu, VD @nhanvatnu)
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">@</span>
                        <Input
                          id="character-tag"
                          value={tagName}
                          onChange={(e) => setTagName(e.target.value)}
                          placeholder="nhanvatnu"
                          maxLength={60}
                          aria-invalid={Boolean(tagError)}
                        />
                      </div>
                      {tagError && <p className="text-xs text-destructive">{tagError}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Giới tính</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button type="button" size="sm" variant={gender === "male" ? "default" : "outline"} onClick={() => setGender("male")}>
                          Nam
                        </Button>
                        <Button type="button" size="sm" variant={gender === "female" ? "default" : "outline"} onClick={() => setGender("female")}>
                          Nữ
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-input p-3">
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-xs text-muted-foreground">Độ tuổi</Label>
                        <span className="text-[11px] text-muted-foreground/70">
                          Khoảng {CHARACTER_MIN_AGE} đến {CHARACTER_MAX_AGE} tuổi
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="outline"
                          aria-label="Giảm độ tuổi"
                          disabled={age <= CHARACTER_MIN_AGE}
                          onClick={() => setAge((a) => Math.max(CHARACTER_MIN_AGE, a - 1))}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{age}</span>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="outline"
                          aria-label="Tăng độ tuổi"
                          disabled={age >= CHARACTER_MAX_AGE}
                          onClick={() => setAge((a) => Math.min(CHARACTER_MAX_AGE, a + 1))}
                        >
                          <Plus className="size-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground">tuổi</span>
                      </div>
                    </div>
                  </CollapsiblePanel>
                </Collapsible>
              </Card>

              <Card className="p-0 overflow-visible">
                <Collapsible defaultOpen className="p-4 flex flex-col gap-3">
                  <CollapsibleTrigger>
                    <SectionHeading step={2} title="Khuôn mặt" icon={ScanFace} />
                  </CollapsibleTrigger>
                  <CollapsiblePanel className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <FieldLabel>Nguồn khuôn mặt</FieldLabel>
                      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border p-1.5">
                        <Button type="button" size="sm" variant={faceSource === "upload" ? "default" : "outline"} onClick={() => setFaceSource("upload")}>
                          <Upload className="size-3.5" />
                          Tải ảnh mặt
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={faceSource === "ai" ? "default" : "outline"}
                          disabled={models.length === 0}
                          title={models.length === 0 ? "Chưa có model AI nào được cấu hình để tạo khuôn mặt." : undefined}
                          onClick={() => setFaceSource("ai")}
                        >
                          <Sparkles className="size-3.5" />
                          AI tự tạo
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <FieldLabel>Xuất thân / dân tộc</FieldLabel>
                      <Select value={ethnicity} onValueChange={(v) => v && setEthnicity(v as CharacterEthnicity)}>
                        <SelectTrigger>
                          <SelectValue>{() => <span className="truncate">{CHARACTER_ETHNICITY_LABEL[ethnicity]}</span>}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ETHNICITY_OPTIONS.map((e) => (
                            <SelectItem key={e} value={e}>
                              {CHARACTER_ETHNICITY_LABEL[e]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {faceSource === "upload" ? (
                      <>
                        {uploadedFace ? (
                          <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                            <img src={uploadedFace.url} alt={uploadedFace.fileName} className="size-10 rounded object-cover" />
                            <div className="flex min-w-0 flex-col">
                              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                                <CheckCircle2 className="size-3" />
                                Ảnh tham chiếu đã tải
                              </span>
                              <span className="truncate text-xs text-muted-foreground">{uploadedFace.fileName}</span>
                              <span className="truncate text-[10px] text-muted-foreground/70">ID: {shortId(uploadedFace.path)}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                              <input
                                id="character-face-replace"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={handleUploadFace}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={uploading}
                                onClick={() => document.getElementById("character-face-replace")?.click()}
                              >
                                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : "Thay ảnh"}
                              </Button>
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                aria-label="Xoá ảnh"
                                onClick={() => {
                                  setUploadedFace(null);
                                  setConsent(false);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <input
                              id="character-face-upload"
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={handleUploadFace}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={uploading}
                              onClick={() => document.getElementById("character-face-upload")?.click()}
                            >
                              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                              {uploading ? "Đang tải lên..." : "Chọn ảnh (PNG, JPG, WEBP — tối đa 10MB)"}
                            </Button>
                            {faceUploadError && <p className="text-xs text-destructive">{faceUploadError}</p>}
                          </>
                        )}
                        <label className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                          Tôi xác nhận đây là ảnh của tôi hoặc người đã đồng ý cho sử dụng.
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Ảnh sẽ được khóa làm danh tính nhân vật khi bạn bấm &quot;Tạo bảng nhân vật&quot; — không thể gửi đi tạo
                          cho đến khi đã xác nhận quyền sử dụng ở trên.
                        </p>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {aiFacePreview ? (
                          <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                            <img src={aiFacePreview.url} alt="Khuôn mặt do AI tạo" className="size-10 rounded object-cover" />
                            <div className="flex min-w-0 flex-col">
                              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                                <CheckCircle2 className="size-3" />
                                {aiFacePreview.isDemo ? "Ảnh minh họa (Demo)" : "Ảnh tham chiếu đã tạo"}
                              </span>
                              <span className="truncate text-[10px] text-muted-foreground/70">ID: {shortId(aiFacePreview.jobId)}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                              <Button type="button" size="sm" variant="ghost" disabled={generatingFace} onClick={handleGenerateAiFace}>
                                Tạo lại
                              </Button>
                              <Button type="button" size="icon-xs" variant="ghost" aria-label="Xoá ảnh" onClick={() => setAiFacePreview(null)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button type="button" size="sm" variant="outline" disabled={generatingFace || !brandId || !sizePresetId} onClick={handleGenerateAiFace}>
                            {generatingFace ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                            {generatingFace ? "Đang tạo..." : "Tạo khuôn mặt bằng AI"}
                          </Button>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Khuôn mặt do AI tạo — không phải ảnh thật của một người cụ thể. Ảnh sẽ được khóa làm danh tính nhân
                          vật khi bạn bấm &quot;Tạo bảng nhân vật&quot;.
                        </p>
                      </div>
                    )}
                  </CollapsiblePanel>
                </Collapsible>
              </Card>
            </>
          ) : (
            <Card className="p-4 flex flex-col gap-3">
              {renaming ? (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Tên nhân vật</Label>
                  <Input value={renameDisplayName} onChange={(e) => setRenameDisplayName(e.target.value)} maxLength={100} />
                  <Label className="text-xs text-muted-foreground">Tag định danh</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">@</span>
                    <Input value={renameTagName} onChange={(e) => setRenameTagName(e.target.value)} maxLength={60} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={savingRename} onClick={handleSaveRename}>
                      {savingRename ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={savingRename} onClick={() => setRenaming(false)}>
                      Huỷ
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                      {selectedCharacter?.faceUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                        <img src={selectedCharacter.faceUrl} alt={selectedCharacter.tagName} className="size-full object-cover" />
                      ) : (
                        <UserRound className="size-5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-sm font-semibold">{selectedCharacter?.displayName || `@${selectedCharacter?.tagName}`}</p>
                      <p className="truncate text-xs text-muted-foreground">@{selectedCharacter?.tagName}</p>
                    </div>
                    <Button type="button" size="icon-xs" variant="ghost" className="ml-auto" aria-label="Đổi tên nhân vật" onClick={startRename}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline">{CHARACTER_GENDER_LABEL[selectedCharacter?.gender ?? "female"]}</Badge>
                    {selectedCharacter && <Badge variant="outline">{CHARACTER_ETHNICITY_LABEL[selectedCharacter.ethnicity]}</Badge>}
                    {selectedCharacter && <Badge variant="outline">{selectedCharacter.age} tuổi</Badge>}
                    <Badge variant="outline">{selectedCharacter?.faceSource === "upload" ? "Ảnh tải lên" : "Ảnh AI"}</Badge>
                    {selectedCharacter?.faceLocked && (
                      <Badge>
                        <Lock className="size-2.5" />
                        Đã khóa
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Khuôn mặt đã khóa, không thể đổi — tạo thêm bảng nhân vật mới cho cùng khuôn mặt này, hoặc bấm
                    &quot;Nhân vật mới&quot; ở trên để bắt đầu một nhân vật khác.
                  </p>
                </>
              )}
            </Card>
          )}

          <Card className="p-0 overflow-visible">
            <Collapsible defaultOpen className="p-4 flex flex-col gap-3">
              <CollapsibleTrigger>
                <SectionHeading step={3} title="Phong cách" summary={styleSummary} />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {CHARACTER_STYLE_PRESETS.map((p) => (
                    <Button key={p.id} type="button" size="sm" variant={style === p.id ? "default" : "outline"} onClick={() => setStyle(p.id)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
                {style === "custom" && (
                  <Input
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="VD: tranh màu nước, tông pastel, nét cọ mềm..."
                    maxLength={MAX_STYLE_LENGTH}
                  />
                )}
              </CollapsiblePanel>
            </Collapsible>
          </Card>

          <Card className="p-0 overflow-visible">
            <Collapsible defaultOpen className="p-4 flex flex-col gap-3">
              <CollapsibleTrigger>
                <SectionHeading step={4} title="Ngoại hình" summary={appearanceSummary} />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="character-appearance" className="text-xs text-muted-foreground">
                    Mô tả tóc, khuôn mặt, vóc dáng, biểu cảm, đặc điểm nhận dạng cần giữ nhất quán
                  </Label>
                  <Textarea
                    id="character-appearance"
                    value={appearanceDescription}
                    onChange={(e) => setAppearanceDescription(e.target.value)}
                    placeholder="VD: tóc dài đen, dáng người cân đối, biểu cảm tươi tắn, đeo khuyên tai tròn màu xanh lá..."
                    maxLength={MAX_APPEARANCE_LENGTH}
                    aria-invalid={appearanceOverLimit}
                  />
                  <div className="flex justify-end">
                    <CharCounter current={appearanceDescription.length} max={MAX_APPEARANCE_LENGTH} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  App chưa có tham số API riêng cho từng góc nhìn/biểu cảm — hệ thống tự chuyển mô tả ở trên thành chỉ
                  dẫn trong prompt của mỗi góc chụp (chọn số góc ở mục &quot;Số ảnh&quot; bên dưới), không cam kết khớp
                  tuyệt đối 100%.
                </p>
                {showNegativePrompt ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="character-negative" className="text-xs text-muted-foreground">
                      Loại trừ — những gì không muốn xuất hiện
                    </Label>
                    <Input
                      id="character-negative"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="VD: kính mát, mũ, nền lộn xộn..."
                      maxLength={MAX_NEGATIVE_PROMPT_LENGTH}
                      aria-invalid={negativePromptOverLimit}
                    />
                    <div className="flex justify-end">
                      <CharCounter current={negativePrompt.length} max={MAX_NEGATIVE_PROMPT_LENGTH} />
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowNegativePrompt(true)} className="w-fit text-xs text-muted-foreground hover:text-foreground">
                    + Thêm phần loại trừ
                  </button>
                )}
              </CollapsiblePanel>
            </Collapsible>
          </Card>

          <Card className="p-0 overflow-visible">
            <Collapsible defaultOpen className="p-4 flex flex-col gap-3">
              <CollapsibleTrigger>
                <SectionHeading step={5} title="Trang phục" summary={outfitSummary} />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-3">
                {outfits.length === 0 && (
                  <p className="text-xs text-muted-foreground">Chưa có bộ trang phục nào — ngoại hình sẽ dùng mô tả mặc định ở trên.</p>
                )}
                {outfits.map((o) => (
                  <div
                    key={o.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border p-2.5",
                      activeOutfitId === o.id ? "border-primary ring-1 ring-primary" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => setActiveOutfitId(o.id)} className="flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className={cn(
                            "flex size-4 items-center justify-center rounded-full border",
                            activeOutfitId === o.id ? "border-primary bg-primary" : "border-input"
                          )}
                        >
                          {activeOutfitId === o.id && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                        </span>
                        {o.label}
                        {activeOutfitId === o.id && <span className="text-[10px] font-normal text-primary">· đang dùng</span>}
                      </button>
                      <Button type="button" size="icon-xs" variant="ghost" aria-label={`Xoá ${o.label}`} onClick={() => removeOutfit(o.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <Textarea
                      value={o.description}
                      onChange={(e) => updateOutfit(o.id, { description: e.target.value })}
                      placeholder="VD: áo khoác denim phối họa tiết hoa, chân váy xếp ly, giày boots da nâu..."
                      maxLength={MAX_OUTFIT_LENGTH}
                    />
                    {o.referenceImage ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                        <img src={o.referenceImage.url} alt={o.referenceImage.fileName} className="size-8 rounded object-cover" />
                        <span className="truncate text-xs text-muted-foreground">{o.referenceImage.fileName}</span>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="ml-auto"
                          aria-label="Xoá ảnh tham chiếu trang phục"
                          onClick={() => updateOutfit(o.id, { referenceImage: null })}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <input
                          id={`outfit-ref-${o.id}`}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => handleUploadOutfitImage(o.id, e)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={uploadingOutfitId === o.id}
                          onClick={() => document.getElementById(`outfit-ref-${o.id}`)?.click()}
                        >
                          {uploadingOutfitId === o.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                          Thêm ảnh tham chiếu trang phục (tuỳ chọn)
                        </Button>
                      </>
                    )}
                    {o.referenceImage && !isMarketingStudioSelected && (
                      <p className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-500">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                        Model đang chọn chỉ nhận 1 ảnh tham chiếu (khuôn mặt) — ảnh này sẽ không được gửi nếu đây là bộ
                        đang dùng, chỉ mô tả văn bản được áp dụng. Chọn Higgsfield Marketing Studio ở mục Model để gửi
                        cả hai ảnh.
                      </p>
                    )}
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" disabled={outfits.length >= MAX_OUTFITS} onClick={addOutfit}>
                  <Shirt className="size-3.5" />
                  Thêm bộ trang phục
                </Button>
              </CollapsiblePanel>
            </Collapsible>
          </Card>

          <Card className="p-0 overflow-visible">
            <Collapsible defaultOpen className="p-4 flex flex-col gap-3">
              <CollapsibleTrigger>
                <SectionHeading step={6} title="Khung ảnh" summary={sizeSummary} />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Chỉ các tỷ lệ/kích thước có sẵn trong workspace</Label>
                  <SizePresetPicker presets={presets} value={sizePresetId} onChange={setSizePresetId} />
                  {presets.length === 0 && <p className="text-xs text-destructive">Workspace chưa có preset kích thước nào.</p>}
                </div>
              </CollapsiblePanel>
            </Collapsible>

            <div className="border-t border-border p-4 flex flex-col gap-3 rounded-b-xl">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Số ảnh</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    aria-label="Giảm số ảnh"
                    disabled={Number(count) <= 1}
                    onClick={() => setCount(String(Math.max(1, Number(count) - 1)))}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-4 text-center text-sm font-medium tabular-nums">{count}</span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    aria-label="Tăng số ảnh"
                    disabled={Number(count) >= CHARACTER_VIEWS.length}
                    onClick={() => setCount(String(Math.min(CHARACTER_VIEWS.length, Number(count) + 1)))}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">{aspectLabel}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{summaryViews}</p>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mô hình AI (chỉ các model đã cấu hình thật)</Label>
                <ModelPicker models={models} value={model} onChange={setModel} />
                {!modelSupportsFaceReference && (
                  <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    Model này chưa hỗ trợ ảnh tham chiếu khuôn mặt trong app — kết quả có thể không khớp khuôn mặt đã
                    khóa (xem ghi chú ở từng ảnh sau khi tạo).
                  </p>
                )}
              </div>

              <Button type="button" size="lg" disabled={!canSubmit} onClick={handleGenerateSheet}>
                {working ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {working ? statusText ?? "Đang tạo..." : "Tạo bảng nhân vật"}
              </Button>
              {!brandId && <p className="text-xs text-destructive">Workspace chưa có thương hiệu active.</p>}
            </div>
          </Card>
        </div>

        {/* Right panel — wider: main viewer + history below */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-4">
            {working && !activeSheet ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                {statusText ?? "Đang tạo..."}
              </div>
            ) : activeSheet ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {activeSheet.views.map((v) => (
                    <CharacterSheetViewCard key={v.jobId || v.view} item={v} onOpenLarge={() => v.url && setViewerItem(v)} />
                  ))}
                </div>
                <SheetMetaFooter sheet={activeSheet} />
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Button type="button" size="sm" variant="outline" disabled={!canSubmit} onClick={handleGenerateSheet}>
                    <RefreshCw className="size-3.5" />
                    Tạo bảng mới
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setSheetPendingDelete(activeSheet)}>
                    <Trash2 className="size-3.5" />
                    Xoá bảng này
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <ImageIconLucide className="size-6" />
                {isNew
                  ? 'Điền thông tin nhân vật và khóa khuôn mặt bên trái, rồi bấm "Tạo bảng nhân vật".'
                  : sheetsStatus === "loading"
                    ? "Đang tải lịch sử..."
                    : sheetsStatus === "error"
                      ? "Không thể tải lịch sử — xem thông báo bên dưới."
                      : 'Nhân vật này chưa có bảng nào — bấm "Tạo bảng nhân vật" để tạo bảng đầu tiên.'}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Lịch sử</p>
              <Badge variant="outline">{sheets.length}</Badge>
            </div>

            {sheetsStatus === "loading" ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Đang tải lịch sử...
              </div>
            ) : sheetsStatus === "error" ? (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="size-3.5" />
                Không thể tải lịch sử bảng nhân vật.
                <Button type="button" size="sm" variant="outline" onClick={() => selectedId && loadSheets(selectedId)}>
                  Thử lại
                </Button>
              </div>
            ) : sheets.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có bảng nhân vật nào cho {isNew ? "nhân vật mới" : "nhân vật này"}.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {sheets.map((sheet, i) => {
                  const cover = sheet.views.find((v) => v.url) ?? sheet.views[0];
                  return (
                    <div key={sheet.sheetId} className="group relative">
                      <button
                        type="button"
                        onClick={() => setActiveSheet(sheet)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
                          activeSheet?.sheetId === sheet.sheetId ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <span className="flex aspect-square items-center justify-center overflow-hidden rounded bg-muted">
                          {cover?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                            <img src={cover.url} alt={`Bảng nhân vật #${sheets.length - i}`} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <ImageIconLucide className="size-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>#{sheets.length - i}</span>
                          <span>{new Date(sheet.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 bg-background"
                        aria-label="Xoá bảng này"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSheetPendingDelete(sheet);
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Xem lớn */}
      <Dialog open={viewerItem !== null} onOpenChange={(open) => !open && setViewerItem(null)}>
        <DialogContent className="sm:max-w-2xl">
          {viewerItem && (
            <>
              <DialogTitle className="sr-only">{CHARACTER_VIEW_LABEL[viewerItem.view]}</DialogTitle>
              <DialogDescription className="sr-only">Xem lớn ảnh nhân vật</DialogDescription>
              <div className="overflow-hidden rounded-lg bg-muted/30">
                {viewerItem.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={viewerItem.url} alt={CHARACTER_VIEW_LABEL[viewerItem.view]} className="max-h-[70vh] w-full object-contain" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{viewerItem.prompt}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {viewerItem.width && viewerItem.height ? `${viewerItem.width}×${viewerItem.height}px` : null}
                  {viewerItem.finalModel && ` · ${modelLabel(viewerItem.finalModel)}`}
                </span>
                {viewerItem.url && viewerItem.savedAssetId && (
                  <DownloadAssetButton assetId={viewerItem.savedAssetId} assetType="image" url={viewerItem.url} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Xác nhận xoá bảng */}
      <AlertDialog open={sheetPendingDelete !== null} onOpenChange={(open) => !open && setSheetPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Xoá bảng nhân vật này?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ ảnh trong bảng này sẽ bị xoá khỏi lịch sử và Thư viện. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSheet}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingSheet}
              onClick={handleConfirmDeleteSheet}
            >
              {deletingSheet ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SheetMetaFooter({ sheet }: { sheet: CharacterSheet }) {
  const main = sheet.views.find((v) => v.status === "succeeded") ?? sheet.views[0];
  if (!main) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
      {main.prompt && <span className="line-clamp-1 max-w-sm">{main.prompt}</span>}
      {main.finalModel && <span>· {modelLabel(main.finalModel)}</span>}
      {main.width && main.height && (
        <span>
          · {main.width}×{main.height}px
        </span>
      )}
      <span>· {new Date(sheet.createdAt).toLocaleString("vi-VN")}</span>
    </div>
  );
}

function CharacterSheetViewCard({ item, onOpenLarge }: { item: CharacterSheetViewItem; onOpenLarge: () => void }) {
  const adjustmentNote = item.attempts.flatMap((a) => a.adjustments ?? []).find((a) => a.toLowerCase().includes("tham chiếu"));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative overflow-hidden rounded-lg bg-muted ring-1 ring-border">
        {item.status === "succeeded" && item.url ? (
          <button type="button" onClick={onOpenLarge} className="group block w-full">
            <FitImage src={item.url} alt={CHARACTER_VIEW_LABEL[item.view]} width={item.width} height={item.height} />
            <span className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all group-hover:bg-background/40 group-hover:opacity-100">
              <Maximize2 className="size-5 text-foreground" />
            </span>
          </button>
        ) : item.status === "succeeded" && !item.url ? (
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 p-3 text-center text-xs text-muted-foreground">
            <AlertTriangle className="size-4" />
            Không tìm thấy ảnh (có thể đã bị xoá khỏi lưu trữ).
          </div>
        ) : item.status === "failed" ? (
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 p-3 text-center text-xs text-destructive">
            <AlertTriangle className="size-4" />
            {item.error || "Không thể tạo ảnh."}
          </div>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{CHARACTER_VIEW_LABEL[item.view]}</span>
        {item.isDemo && (
          <Badge variant="outline" className="text-[10px]">
            Demo
          </Badge>
        )}
      </div>
      {adjustmentNote && <p className="text-[11px] text-amber-600 dark:text-amber-500">{adjustmentNote}</p>}
    </div>
  );
}
