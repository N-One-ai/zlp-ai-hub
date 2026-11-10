"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
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
  Camera,
  Palette,
  Drama,
  Clapperboard,
  Newspaper,
  Wand2,
  Check,
  Sparkle,
  SquarePen,
  Grid3x3,
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
import {
  HAIRSTYLE_OPTIONS,
  BODY_TYPE_OPTIONS,
  EXPRESSION_OPTIONS,
  DEFAULT_APPEARANCE_OPTION_ID,
  appearancePhrase,
  appearanceLabel,
  type CharacterAppearanceOption,
} from "@/lib/generation/character-appearance";
import { OUTFIT_PRESETS, DEFAULT_OUTFIT_PRESET_ID, outfitPresetLabel } from "@/lib/generation/character-outfit";
import { AUTO_MODEL_ID, modelLabel, type ModelMeta } from "@/lib/generation/model-meta";
import {
  CHARACTER_ETHNICITY_LABEL,
  CHARACTER_GENDER_LABEL,
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

// The only model in this app whose adapter accepts a SECOND reference
// image AND a real aspect_ratio/resolution param (see
// providers/marketing-studio-provider.ts, which reads `referenceImageUrls`
// and `aspect_ratio`/`resolution` directly) — mirrors the same condition
// in character-actions.ts's createCharacterSheet (there derived from
// capabilities.supportsAspectRatioResolution, not this literal id, since
// the server also has to handle "auto" resolving to a different model).
const MARKETING_STUDIO_MODEL_ID = "higgsfield-marketing-studio";
const MARKETING_STUDIO_RESOLUTION_CHIPS = ["1k", "2k", "4k"] as const;
const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_ATTEMPTS = 100; // ~150s, same margin as ImageComposer
const MAX_APPEARANCE_LENGTH = 600; // mirrors MAX_APPEARANCE_LENGTH in character-actions.ts (the COMPOSED description's real ceiling)
const MAX_APPEARANCE_NOTES_LENGTH = 450; // leaves headroom in MAX_APPEARANCE_LENGTH for the 3 chip phrases once joined
const MAX_OUTFIT_LENGTH = 400;
const MAX_STYLE_LENGTH = 200;
const MAX_NEGATIVE_PROMPT_LENGTH = 500;
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const TAG_REGEX = /^[a-zA-Z0-9_.]+$/;
const ETHNICITY_OPTIONS: CharacterEthnicity[] = ["vietnamese", "asian", "european"];
const STYLE_ICONS: Record<CharacterStyleId, LucideIcon> = {
  photo: Camera,
  illustration: Palette,
  cartoon: Drama,
  cinematic: Clapperboard,
  editorial: Newspaper,
  custom: Wand2,
};
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

type OutfitMode = "preset" | "custom" | "upload";

interface OutfitUploadedImage {
  url: string;
  fileName: string;
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

/** Single-select chip row for one "Ngoại hình" category (Kiểu tóc/Vóc
 * dáng/Biểu cảm) — always exactly one option active, "Tự nhiên" being the
 * neutral default that adds nothing to the prompt. */
function AppearanceChipGroup({
  options,
  value,
  onChange,
}: {
  options: CharacterAppearanceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={selected}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            {selected && <Check className="size-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
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

/** The 5 standard ratios shown as chips in "Size ảnh" — all 5 are always
 * selectable. When the workspace has a size preset of that exact ratio,
 * picking the chip uses that preset's own (authoritative) pixel
 * dimensions; otherwise the request falls back to `exactSize` (most
 * models — each adapter further snaps to its own real supported size,
 * see pixelsForRatio below) or `aspectRatio`+`resolution` for Marketing
 * Studio specifically (its real API has no width/height param at all —
 * see character-actions.ts's resolveSizeFields, the exact same logic
 * mirrored client-side here only for display purposes). */
const ASPECT_RATIO_CHIPS: { ratio: string; label: string; w: number; h: number }[] = [
  { ratio: "16:9", label: "16:9 Ngang", w: 16, h: 9 },
  { ratio: "4:3", label: "4:3", w: 4, h: 3 },
  { ratio: "1:1", label: "1:1 Vuông", w: 1, h: 1 },
  { ratio: "3:4", label: "3:4 Dọc", w: 3, h: 4 },
  { ratio: "9:16", label: "9:16 Dọc", w: 9, h: 16 },
];
const DEFAULT_RATIO = "1:1";

/** Pixel size for a ratio with no matching workspace preset — a baseline
 * long edge, scaled to the exact ratio. Never sent as-is blindly: Higgsfield
 * and OpenAI's own adapters snap this to their real nearest supported size
 * server-side (see providers/higgsfield-provider.ts, openai-provider.ts);
 * Gemini accepts arbitrary pixel sizes directly, so this IS what it receives. */
function pixelsForRatio(w: number, h: number): { width: number; height: number } {
  const longEdge = 1024;
  return w >= h ? { width: longEdge, height: Math.round((longEdge * h) / w) } : { width: Math.round((longEdge * w) / h), height: longEdge };
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
  // The settings column below the character-pill row scrolls independently
  // (see its lg:overflow-y-auto wrapper) — switching characters swaps its
  // content but previously left the old scrollTop in place, so the new
  // card could render partly above the visible scroll area and look cut
  // off. Reset to top on every switch so the newly selected card's info is
  // never hidden by a stale scroll position.
  const settingsScrollRef = useRef<HTMLDivElement>(null);

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

  // Step 4 — Ngoại hình (chip presets, composed into one description
  // string client-side — see composeAppearanceDescription below — so the
  // existing appearanceDescription field on generateCharacterFace()/
  // createCharacterSheet() needed no schema change for this)
  const [hairstyle, setHairstyle] = useState(DEFAULT_APPEARANCE_OPTION_ID);
  const [bodyType, setBodyType] = useState(DEFAULT_APPEARANCE_OPTION_ID);
  const [expression, setExpression] = useState(DEFAULT_APPEARANCE_OPTION_ID);
  const [appearanceNotes, setAppearanceNotes] = useState("");
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");

  // Step 5 — Trang phục: 1 trong 3 chế độ (gợi ý sẵn / tự nhập / tải ảnh),
  // không phải nhiều bộ cùng lúc — mỗi chế độ ghi vào đúng cặp trường
  // outfitDescription/outfitReferenceImageUrl đã có sẵn ở createCharacterSheet.
  const [outfitMode, setOutfitMode] = useState<OutfitMode>("preset");
  const [outfitPresetId, setOutfitPresetId] = useState(DEFAULT_OUTFIT_PRESET_ID);
  const [outfitCustomText, setOutfitCustomText] = useState("");
  const [outfitUploadedImage, setOutfitUploadedImage] = useState<OutfitUploadedImage | null>(null);
  const [uploadingOutfitImage, setUploadingOutfitImage] = useState(false);

  // Only used for the "AI tự tạo khuôn mặt" helper's own generateCharacterFace()
  // call now — the character SHEET itself is always requested at a fixed
  // 16:9 (see createCharacterSheet), so this is no longer a user-facing
  // picker; a sensible fixed default (matching a workspace preset's ratio
  // when one exists) is enough for a single reference-face portrait.
  const [aspectRatioChoice] = useState<string>(() => {
    const initial = presets[0] ? aspectRatioLabel(presets[0].width, presets[0].height) : DEFAULT_RATIO;
    return ASPECT_RATIO_CHIPS.some((c) => c.ratio === initial) ? initial : DEFAULT_RATIO;
  });

  // Mô hình AI — defaults to Marketing Studio when configured: it's the
  // only model whose real schema has both aspect_ratio (so "16:9" can be
  // requested directly) and a 2-image reference slot (face + outfit) —
  // see createCharacterSheet's own doc comment. Falls back to whatever
  // else is configured otherwise, same as every other picker in this app.
  const defaultModel = models.find((m) => m.id === MARKETING_STUDIO_MODEL_ID)?.id ?? models[0]?.id ?? AUTO_MODEL_ID;
  const [model, setModel] = useState<string>(defaultModel);
  const [resolution, setResolution] = useState<(typeof MARKETING_STUDIO_RESOLUTION_CHIPS)[number]>("2k");

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

  const selectedModelMeta = models.find((m) => m.id === model);
  const modelSupportsFaceReference = (selectedModelMeta?.maxReferenceImages ?? (model === AUTO_MODEL_ID ? 1 : 0)) >= 1;
  const isMarketingStudioSelected = model === MARKETING_STUDIO_MODEL_ID;
  const selectedRatioChip = ASPECT_RATIO_CHIPS.find((c) => c.ratio === aspectRatioChoice)!;
  // The workspace preset matching the chosen ratio, if any — exact,
  // authoritative dimensions take priority over the computed fallback.
  const matchingPreset = presets.find((p) => aspectRatioLabel(p.width, p.height) === aspectRatioChoice);
  // What actually gets sent to createCharacterSheet()/generateCharacterFace()
  // — mirrors resolveSizeFields() in character-actions.ts exactly, so the
  // size shown here is always the size that's really requested, never a
  // UI-only approximation.
  const sizeFieldsToSend = matchingPreset
    ? { sizePresetId: matchingPreset.id }
    : isMarketingStudioSelected
      ? { aspectRatio: aspectRatioChoice, resolution: "1k" }
      : { exactSize: pixelsForRatio(selectedRatioChip.w, selectedRatioChip.h) };
  const negativePromptOverLimit = negativePrompt.length > MAX_NEGATIVE_PROMPT_LENGTH;

  // What actually gets sent, per outfit mode — "upload" only ever sends
  // the image (no text), "preset"/"custom" only ever send text (no
  // image); never both, so there's no ambiguity about which one the
  // server should prefer.
  const outfitDescriptionToSend =
    outfitMode === "preset" ? outfitPresetLabel(outfitPresetId) : outfitMode === "custom" ? outfitCustomText.trim() : "";
  const outfitImageToSend = outfitMode === "upload" ? outfitUploadedImage : null;

  // Composed from the 3 chip categories (each "" when "Tự nhiên"/default is
  // picked) + free-text notes — this is what actually gets sent as
  // `appearanceDescription` to generateCharacterFace()/createCharacterSheet(),
  // no backend change needed since that field already accepted free text.
  const appearanceDescription = [
    appearancePhrase(HAIRSTYLE_OPTIONS, hairstyle),
    appearancePhrase(BODY_TYPE_OPTIONS, bodyType),
    appearancePhrase(EXPRESSION_OPTIONS, expression),
    appearanceNotes.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  // Validated against the COMPOSED string (what the server's own schema
  // actually checks), not just the notes field alone.
  const appearanceOverLimit = appearanceDescription.length > MAX_APPEARANCE_LENGTH;

  const styleSummary =
    style === "custom"
      ? customStyle.trim()
        ? `Tùy chỉnh — ${truncateLabel(customStyle, 24)}`
        : "Tùy chỉnh"
      : characterStyleLabel(style);
  const appearanceSummary = [
    hairstyle !== DEFAULT_APPEARANCE_OPTION_ID ? appearanceLabel(HAIRSTYLE_OPTIONS, hairstyle) : null,
    bodyType !== DEFAULT_APPEARANCE_OPTION_ID ? appearanceLabel(BODY_TYPE_OPTIONS, bodyType) : null,
    expression !== DEFAULT_APPEARANCE_OPTION_ID ? appearanceLabel(EXPRESSION_OPTIONS, expression) : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Mặc định";
  const outfitSummary =
    outfitMode === "preset"
      ? outfitPresetLabel(outfitPresetId)
      : outfitMode === "custom"
        ? outfitCustomText.trim()
          ? truncateLabel(outfitCustomText, 24)
          : "Tự nhập — chưa có mô tả"
        : outfitUploadedImage
          ? "Ảnh tải lên"
          : "Chưa có ảnh";

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
    settingsScrollRef.current?.scrollTo({ top: 0 });
  }

  function selectCharacter(id: string) {
    setSelectedId(id);
    setSheets([]);
    setActiveSheet(null);
    setRenaming(false);
    void loadSheets(id);
    settingsScrollRef.current?.scrollTo({ top: 0 });
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

  async function handleUploadOutfitImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > UPLOAD_MAX_BYTES) {
      toast.error("File quá lớn. Tối đa 10MB.");
      return;
    }
    setUploadingOutfitImage(true);
    try {
      const result = await uploadReferenceImage(file);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOutfitUploadedImage({ url: result.data.url, fileName: file.name });
    } finally {
      setUploadingOutfitImage(false);
    }
  }

  async function handleGenerateAiFace() {
    if (!brandId || generatingFace) return;
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
        ...sizeFieldsToSend,
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

      // ONE request, ONE model call — no per-view loop, no client-side
      // compositing. See createCharacterSheet's own doc comment
      // (character-actions.ts) for exactly what gets sent.
      setStatusText("Đang gửi 1 yêu cầu tạo character sheet (1 lần gọi model)...");
      const sheetResult = await createCharacterSheet({
        characterId,
        brandId,
        model,
        resolution,
        style,
        customStyle,
        appearanceDescription,
        outfitDescription: outfitDescriptionToSend,
        outfitReferenceImageUrl: outfitImageToSend?.url,
        negativePrompt,
      });
      if (!sheetResult.ok) {
        toast.error(sheetResult.error.message);
        return;
      }
      if (outfitImageToSend && !sheetResult.data.outfitImageSent) {
        toast.message(
          `Model "${modelLabel(model)}" không hỗ trợ ảnh tham chiếu trang phục — chỉ ảnh khuôn mặt được gửi. Chọn Higgsfield Marketing Studio để dùng ảnh này, hoặc đổi sang "Tự nhập" để mô tả bằng văn bản.`
        );
      }

      const r = sheetResult.data.results[0];
      let resolvedView: CharacterSheetViewItem;
      if (!r || !r.ok || !r.jobId) {
        resolvedView = {
          view: r?.view ?? "composite",
          jobId: r?.jobId ?? "",
          status: "failed",
          url: null,
          width: null,
          height: null,
          isDemo: false,
          savedAssetId: null,
          error: r?.error ?? "Không thể tạo character sheet lúc này.",
          prompt: "",
          requestedModel: model,
          finalModel: null,
          attempts: [],
        };
      } else {
        setStatusText("Đang chờ model trả về ảnh — request đã gửi, đang theo dõi trạng thái thật...");
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
            name: `${label} — Character sheet (6 góc, 16:9)`,
          });
          if (saveResult.ok) savedAssetId = saveResult.data.assetId;
        }
        resolvedView = {
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
        };
      }

      const newSheet: CharacterSheet = {
        sheetId: sheetResult.data.sheetId,
        characterId,
        createdAt: new Date().toISOString(),
        views: [resolvedView],
      };
      setActiveSheet(newSheet);
      setSheets((prev) => [newSheet, ...prev]);

      if (resolvedView.status === "succeeded" && resolvedView.url) {
        toast.success("Đã tạo 1 ảnh character sheet (6 góc gộp trong 1 ảnh, 1 lần gọi model).");
      } else {
        toast.error(resolvedView.error || "Không thể tạo character sheet lúc này. Kiểm tra ghi chú lỗi bên dưới.");
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
        <span>Character sheet 16:9 · 6 góc · 1 ảnh</span>
        <span>·</span>
        <span>{styleSummary}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
        {/* Left panel — character list + form. The pill row never scrolls
            (always fully visible, wraps on narrow screens); only the
            settings cards below it scroll, in their own bounded container,
            independently from the result panel on desktop. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          {characters.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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

          {/* [&>*]:shrink-0 is load-bearing, not decorative: Card (see
              components/ui/card.tsx) ships `overflow-hidden` by default,
              which per the flexbox spec makes a flex item's automatic
              min-height 0 — so without this, every Card here would
              flex-shrink below its own content height to fit this
              container's max-height instead of actually overflowing and
              scrolling, visibly crushing whichever card has the smallest
              content (this is exactly what was clipping the selected-
              character info card). Keeping each Card at shrink-0 forces
              the container to overflow for real, which lg:overflow-y-auto
              then scrolls as intended. */}
          <div
            ref={settingsScrollRef}
            className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-y-auto lg:pr-1 [&>*]:shrink-0"
          >

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
                          <Button type="button" size="sm" variant="outline" disabled={generatingFace || !brandId} onClick={handleGenerateAiFace}>
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
                <div className="flex flex-col gap-2">
                  <FieldLabel>Phong cách chủ đạo</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {CHARACTER_STYLE_PRESETS.map((p) => {
                      const Icon = STYLE_ICONS[p.id];
                      const selected = style === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setStyle(p.id)}
                          aria-pressed={selected}
                          className={cn(
                            "relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"
                          )}
                        >
                          {selected && (
                            <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-2.5" />
                            </span>
                          )}
                          <span
                            className={cn(
                              "flex size-9 items-center justify-center rounded-lg",
                              selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Icon className="size-4.5" />
                          </span>
                          <span className={cn("text-sm font-semibold", selected && "text-primary")}>{p.label}</span>
                          <span className="text-xs text-muted-foreground">{p.description}</span>
                        </button>
                      );
                    })}
                  </div>
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
                <SectionHeading step={4} title="Ngoại hình" summary={appearanceSummary} icon={Sparkle} />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <FieldLabel>Kiểu tóc</FieldLabel>
                  <AppearanceChipGroup options={HAIRSTYLE_OPTIONS} value={hairstyle} onChange={setHairstyle} />
                </div>
                <div className="flex flex-col gap-2">
                  <FieldLabel>Vóc dáng</FieldLabel>
                  <AppearanceChipGroup options={BODY_TYPE_OPTIONS} value={bodyType} onChange={setBodyType} />
                </div>
                <div className="flex flex-col gap-2">
                  <FieldLabel>Biểu cảm</FieldLabel>
                  <AppearanceChipGroup options={EXPRESSION_OPTIONS} value={expression} onChange={setExpression} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="character-appearance-notes" className="text-xs text-muted-foreground">
                    Ghi chú thêm (tuỳ chọn) — khuôn mặt, đặc điểm nhận dạng, phụ kiện...
                  </Label>
                  <Textarea
                    id="character-appearance-notes"
                    value={appearanceNotes}
                    onChange={(e) => setAppearanceNotes(e.target.value)}
                    placeholder="VD: đeo khuyên tai tròn màu xanh lá, có nốt ruồi nhỏ trên má..."
                    maxLength={MAX_APPEARANCE_NOTES_LENGTH}
                  />
                  <div className="flex justify-end">
                    <CharCounter current={appearanceNotes.length} max={MAX_APPEARANCE_NOTES_LENGTH} />
                  </div>
                  {appearanceOverLimit && (
                    <p className="text-xs text-destructive">Tổng mô tả ngoại hình vượt giới hạn — rút ngắn ghi chú thêm.</p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  App chưa có tham số API riêng cho ngoại hình — hệ thống tự chuyển các lựa chọn ở trên thành mô tả
                  trong một prompt duy nhất, áp dụng cho cả 6 góc trong character sheet, không cam kết khớp tuyệt đối
                  100%.
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
                <SectionHeading step={5} title="Trang phục" summary={outfitSummary} icon={Shirt} />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <FieldLabel>Chế độ trang phục</FieldLabel>
                  <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border p-1.5">
                    <Button type="button" size="sm" variant={outfitMode === "preset" ? "default" : "outline"} onClick={() => setOutfitMode("preset")}>
                      <Sparkle className="size-3.5" />
                      Gợi ý sẵn
                    </Button>
                    <Button type="button" size="sm" variant={outfitMode === "custom" ? "default" : "outline"} onClick={() => setOutfitMode("custom")}>
                      <SquarePen className="size-3.5" />
                      Tự nhập
                    </Button>
                    <Button type="button" size="sm" variant={outfitMode === "upload" ? "default" : "outline"} onClick={() => setOutfitMode("upload")}>
                      <Upload className="size-3.5" />
                      Tải ảnh
                    </Button>
                  </div>
                </div>

                {outfitMode === "preset" && (
                  <div className="flex flex-col gap-2">
                    <FieldLabel>Bộ trang phục gợi ý</FieldLabel>
                    <div className="flex flex-col gap-1.5">
                      {OUTFIT_PRESETS.map((p) => {
                        const selected = outfitPresetId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setOutfitPresetId(p.id)}
                            aria-pressed={selected}
                            className={cn(
                              "flex items-center gap-2 rounded-full border px-4 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {selected && <Check className="size-3.5 shrink-0" />}
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {outfitMode === "custom" && (
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Mô tả trang phục</FieldLabel>
                    <Textarea
                      value={outfitCustomText}
                      onChange={(e) => setOutfitCustomText(e.target.value)}
                      placeholder="VD: áo khoác denim phối họa tiết hoa, chân váy xếp ly, giày boots da nâu..."
                      maxLength={MAX_OUTFIT_LENGTH}
                    />
                    <div className="flex justify-end">
                      <CharCounter current={outfitCustomText.length} max={MAX_OUTFIT_LENGTH} />
                    </div>
                  </div>
                )}

                {outfitMode === "upload" && (
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Ảnh tham chiếu trang phục</FieldLabel>
                    {outfitUploadedImage ? (
                      <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                        <img src={outfitUploadedImage.url} alt={outfitUploadedImage.fileName} className="size-10 rounded object-cover" />
                        <span className="truncate text-xs text-muted-foreground">{outfitUploadedImage.fileName}</span>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="ml-auto"
                          aria-label="Xoá ảnh tham chiếu trang phục"
                          onClick={() => setOutfitUploadedImage(null)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <input
                          id="outfit-ref-upload"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleUploadOutfitImage}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={uploadingOutfitImage}
                          onClick={() => document.getElementById("outfit-ref-upload")?.click()}
                        >
                          {uploadingOutfitImage ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                          Chọn ảnh (PNG, JPG, WEBP — tối đa 10MB)
                        </Button>
                      </>
                    )}
                    {outfitUploadedImage &&
                      (isMarketingStudioSelected ? (
                        <p className="flex items-start gap-1 text-[11px] text-emerald-600 dark:text-emerald-500">
                          <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                          Ảnh này sẽ được gửi làm ảnh tham chiếu trang phục (chỉ lấy kiểu dáng/màu sắc/họa tiết — khuôn
                          mặt và danh tính luôn theo ảnh khuôn mặt).
                        </p>
                      ) : (
                        <p className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-500">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                          Model đang chọn chỉ nhận 1 ảnh tham chiếu (khuôn mặt) — ảnh này sẽ không được gửi. Chọn
                          Higgsfield Marketing Studio ở mục Model để dùng ảnh này làm tham chiếu trang phục.
                        </p>
                      ))}
                  </div>
                )}
              </CollapsiblePanel>
            </Collapsible>
          </Card>

          <Card className="p-0 overflow-visible">
            <Collapsible defaultOpen className="p-4 flex flex-col gap-3">
              <CollapsibleTrigger>
                <SectionHeading step={6} title="Đầu ra" summary="16:9 · 6 góc · 1 lần gọi model" icon={Grid3x3} />
              </CollapsibleTrigger>
              <CollapsiblePanel className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
                  <Grid3x3 className="mt-0.5 size-3.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">1 ảnh đầu ra · 6 góc trong cùng một ảnh · 1 lần gọi model</span>
                    <span className="text-muted-foreground">
                      Không tạo 6 ảnh riêng, không ghép ảnh ở app — model được yêu cầu vẽ thẳng một contact sheet
                      16:9 gồm 2 ô toàn thân lớn + 4 ô chân dung. Không model nào hỗ trợ sẵn bố cục nhiều ô, nên kết
                      quả phụ thuộc vào việc model có làm theo mô tả hay không — không đảm bảo luôn đủ đúng 6 ô.
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>Độ phân giải</FieldLabel>
                  {isMarketingStudioSelected ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {MARKETING_STUDIO_RESOLUTION_CHIPS.map((r) => {
                          const selected = r === resolution;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setResolution(r)}
                              aria-pressed={selected}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                selected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {r.toUpperCase()}
                              {selected && <Check className="size-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Gửi aspect_ratio: &quot;16:9&quot; · resolution: &quot;{resolution}&quot; thẳng tới Higgsfield
                        Marketing Studio (model hỗ trợ 2 tham số này trực tiếp theo schema thật).
                      </p>
                    </>
                  ) : (
                    <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      Model đang chọn không có tham số aspect_ratio/resolution riêng — app sẽ yêu cầu kích thước
                      pixel 1920×1080 (16:9) thay thế. Chọn Higgsfield Marketing Studio để gửi đúng tham số thật của
                      model.
                    </p>
                  )}
                </div>
              </CollapsiblePanel>
            </Collapsible>

            <div className="border-t border-border p-4 flex flex-col gap-3 rounded-b-xl">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mô hình AI (chỉ các model đã cấu hình thật)</Label>
                <ModelPicker models={models} value={model} onChange={setModel} />
                {!modelSupportsFaceReference && (
                  <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    Model này chưa hỗ trợ ảnh tham chiếu khuôn mặt trong app — kết quả có thể không khớp khuôn mặt đã
                    khóa (xem ghi chú sau khi tạo).
                  </p>
                )}
              </div>

              <Button type="button" size="lg" disabled={!canSubmit} onClick={handleGenerateSheet}>
                {working ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {working ? statusText ?? "Đang tạo..." : "Tạo character sheet"}
              </Button>
              {!brandId && <p className="text-xs text-destructive">Workspace chưa có thương hiệu active.</p>}
            </div>
          </Card>
          </div>
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
                {(() => {
                  // Exactly one item now — one request, one model call, one
                  // image (see createCharacterSheet's own doc comment). No
                  // separate per-view images, so nothing to pick from.
                  const item = activeSheet.views[0] ?? null;
                  if (!item) return null;
                  if (item.status === "succeeded" && item.url) {
                    return (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Grid3x3 className="size-3.5" />
                          Character sheet — 1 ảnh · 6 góc · 16:9
                        </div>
                        <button type="button" onClick={() => setViewerItem(item)} className="group block w-full">
                          <div className="relative overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                            <FitImage src={item.url} alt={CHARACTER_VIEW_LABEL.composite} width={item.width} height={item.height} />
                            <span className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all group-hover:bg-background/40 group-hover:opacity-100">
                              <Maximize2 className="size-5 text-foreground" />
                            </span>
                          </div>
                        </button>
                        {item.isDemo && (
                          <Badge variant="outline" className="w-fit text-[10px]">
                            Demo
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <AlertTriangle className="size-6 text-destructive/70" />
                      <p className="text-sm text-destructive">{item.error || "Không thể tạo character sheet lúc này."}</p>
                    </div>
                  );
                })()}
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
                  const cover =
                    sheet.views.find((v) => v.view === "composite" && v.url) ?? sheet.views.find((v) => v.url) ?? sheet.views[0];
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
  const main = sheet.views[0];
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

