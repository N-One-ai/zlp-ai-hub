"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Download, Save, Check, Play, Pause, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandPicker } from "@/components/brand/brand-picker";
import { CharCounter } from "@/components/generate/char-counter";
import {
  createVoiceGenerationAction,
  getVoiceGenerationStatusAction,
  saveVoiceAssetAction,
  previewVoiceSampleAction,
} from "@/lib/voice/actions";
import {
  VBEE_SYNC_MAX_CHARS,
  VBEE_BATCH_MAX_CHARS,
  VBEE_SYNC_VOICE_CODES,
  VBEE_VALID_BITRATES,
  VBEE_OUTPUT_FORMATS,
  VBEE_PREVIEW_SAMPLE_MAX_CHARS,
} from "@/types/voice";
import type { VbeeVoice, VoiceGenerationJob } from "@/types/voice";
import type { Brand } from "@/types/brand";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 200; // ~10 phút — văn bản dài qua Batch API có thể mất vài phút

// 5 muted accent tones from the design system's own chart palette — never
// a photo, never attributed to a specific real person, just a stable
// per-voice color so the list is visually scannable.
const AVATAR_TONES = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Vbee's own TTS API has no avatar/photo field (confirmed against the
 * live response) — so initials are the honest baseline fallback:
 * 2-letter initials from the voice's own display name (stripping a
 * leading region tag like "HN - "/"SG - "), never an unrelated stock
 * photo misattributed to a specific voice. */
function voiceInitials(name: string): string {
  const stripped = name.replace(/^[A-Za-zÀ-ỹ]{1,3}\s*-\s*/, "").trim();
  const base = stripped || name;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Vbee's own marketing site (vbee.vn/text-to-speech) DOES show a real
 * round headshot per announcer, served from
 * vbee-studio-data.s3.ap-southeast-1.amazonaws.com/images/voices/round/
 * <slug>.png — confirmed live for 6 voices (Ngọc Huyền, Mạnh Dũng, Thảo
 * Trinh, Anh Khôi, Mai Phương, Tường Vy), where <slug> is exactly the
 * voice's own display name (region prefix stripped) with diacritics
 * removed and hyphenated. This isn't a documented API, so the slug is
 * derived with the SAME name, never guessed from a different voice —
 * if a given voice's photo isn't actually hosted there the image 404s
 * and the <img onError> below falls back to the initials circle, so a
 * voice can never end up showing the WRONG person's photo. */
function voicePhotoSlug(name: string): string {
  const stripped = name.replace(/^[A-Za-zÀ-ỹ]{1,3}\s*-\s*/, "").trim() || name;
  return stripped
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function voicePhotoUrl(name: string): string {
  return `https://vbee-studio-data.s3.ap-southeast-1.amazonaws.com/images/voices/round/${voicePhotoSlug(name)}.png`;
}

function VoiceAvatar({ voice, className }: { voice: VbeeVoice; className?: string }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const tone = AVATAR_TONES[hashString(voice.code) % AVATAR_TONES.length];

  if (!photoFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Vbee CDN host, not in next/image's configured domains, and this needs a plain onError fallback
      <img
        src={voicePhotoUrl(voice.name)}
        alt=""
        aria-hidden="true"
        className={`size-7 shrink-0 rounded-full object-cover bg-muted ${className ?? ""}`}
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${tone} ${className ?? ""}`}
      aria-hidden="true"
    >
      {voiceInitials(voice.name)}
    </span>
  );
}

type PreviewState = "idle" | "loading" | "playing" | "error";

export function VoiceComposer({
  brands,
  voicesResult,
}: {
  brands: Brand[];
  voicesResult: { ok: true; voices: VbeeVoice[] } | { ok: false; code: string; message: string };
}) {
  const [brandId, setBrandId] = useState<string | null>(brands[0]?.id ?? null);
  const [text, setText] = useState("");
  const [voiceCode, setVoiceCode] = useState<string>(voicesResult.ok ? voicesResult.voices[0]?.code ?? "" : "");
  const [outputFormat, setOutputFormat] = useState<(typeof VBEE_OUTPUT_FORMATS)[number]>("mp3");
  const [bitrate, setBitrate] = useState<(typeof VBEE_VALID_BITRATES)[number]>(128);
  const [speed, setSpeed] = useState(1.0);
  const [generating, setGenerating] = useState(false);
  const [job, setJob] = useState<VoiceGenerationJob | null>(null);
  const [saving, setSaving] = useState(false);
  const pollAttemptsRef = useRef(0);

  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewCacheRef = useRef<Map<string, string>>(new Map());

  const voices = voicesResult.ok ? voicesResult.voices : [];
  const selectedVoice = voices.find((v) => v.code === voiceCode) ?? null;
  const isSyncEligible = (VBEE_SYNC_VOICE_CODES as readonly string[]).includes(voiceCode);
  // The input's own cap is always the Batch ceiling — sync vs async is
  // just which PATH a given text/voice combination takes, decided
  // server-side the same way (see createVoiceGenerationAction), never a
  // separate client-side limit to keep in sync.
  const maxChars = VBEE_BATCH_MAX_CHARS;
  const willUseSync = text.trim().length > 0 && text.length <= VBEE_SYNC_MAX_CHARS && isSyncEligible;
  const textOverLimit = text.length > maxChars;
  const busy = generating || job?.status === "processing";

  // Polls only an in-flight ASYNC job — a sync job already resolves
  // (success or failure) within the createVoiceGenerationAction call
  // itself, so there's nothing to poll for it.
  useEffect(() => {
    if (!job || job.status !== "processing" || job.mode !== "async") return;
    pollAttemptsRef.current = 0;
    let cancelled = false;
    const interval = setInterval(async () => {
      pollAttemptsRef.current += 1;
      const next = await getVoiceGenerationStatusAction(job.id);
      if (cancelled) return;
      if (next) setJob(next);
      if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) clearInterval(interval);
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-keyed only on id/status/mode, not the whole job object, so a field update from THIS SAME poll (setJob below) never restarts the interval
  }, [job?.id, job?.status, job?.mode]);

  // Changing the selected voice must stop any currently-playing preview —
  // continuing to play the PREVIOUS voice's audio while a different one
  // is now selected would be actively misleading. Handled directly in the
  // Select's onValueChange (not an effect keyed on voiceCode) since this
  // is a direct response to that one user action, not a sync with an
  // external system.
  function handleVoiceChange(next: string) {
    stopPreview();
    setPreviewState("idle");
    setPreviewError(null);
    setVoiceCode(next);
  }

  function stopPreview() {
    const audio = previewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  async function handlePreview() {
    if (!selectedVoice || previewState === "loading") return;

    // Already playing this voice's preview — treat a second click as pause.
    if (previewState === "playing") {
      stopPreview();
      setPreviewState("idle");
      return;
    }

    setPreviewError(null);

    const playUrl = (url: string) => {
      const audio = previewAudioRef.current;
      if (!audio) return;
      audio.src = url;
      audio.play().catch(() => {
        setPreviewState("error");
        setPreviewError("Không thể phát audio mẫu trên thiết bị này.");
      });
    };

    const userText = text.trim();

    // Primary path: the user's OWN text, read by the exact selected voice
    // — this is what "nghe thử trước khi tạo" actually means, not an
    // unrelated canned demo sentence. Only possible on the 5 voices the
    // Realtime (sync) API supports, and only a short, capped excerpt
    // (never the full script) — this calls Vbee's real TTS endpoint
    // (billable/quota), disclosed in the caption rendered near the button.
    if (userText && isSyncEligible) {
      const sampleText = userText.slice(0, VBEE_PREVIEW_SAMPLE_MAX_CHARS);
      const cacheKey = `${voiceCode}:${sampleText}`;
      const cached = previewCacheRef.current.get(cacheKey);
      if (cached) {
        setPreviewState("loading");
        playUrl(cached);
        return;
      }
      setPreviewState("loading");
      try {
        const result = await previewVoiceSampleAction({ voiceCode, text: sampleText });
        if (!result.ok) {
          setPreviewState("error");
          setPreviewError(result.error.message);
          return;
        }
        previewCacheRef.current.set(cacheKey, result.data.dataUrl);
        playUrl(result.data.dataUrl);
      } catch {
        setPreviewState("error");
        setPreviewError("Đã có lỗi xảy ra khi tạo đoạn nghe thử.");
      }
      return;
    }

    // Fallback 1: no text typed yet (nothing of the user's own to
    // preview), or the voice doesn't support the Realtime API at all —
    // play Vbee's own generic per-voice sample instead, free and
    // instant, so the user can still hear what the VOICE sounds like.
    if (selectedVoice.demoUrl) {
      setPreviewState("loading");
      playUrl(selectedVoice.demoUrl);
      return;
    }

    // Fallback 2: no demoUrl either. If sync-eligible, synthesize a
    // short canned sentence so there's still something to hear.
    if (!isSyncEligible) {
      setPreviewState("error");
      setPreviewError(
        userText
          ? "Giọng này không hỗ trợ nghe thử nội dung tùy chỉnh và cũng chưa có audio mẫu."
          : "Giọng này chưa có audio mẫu và không hỗ trợ nghe thử tức thời."
      );
      return;
    }

    const sampleText = "Xin chào, đây là giọng đọc mẫu từ Vbee.".slice(0, VBEE_PREVIEW_SAMPLE_MAX_CHARS);
    const cacheKey = `${voiceCode}:${sampleText}`;
    const cached = previewCacheRef.current.get(cacheKey);
    if (cached) {
      setPreviewState("loading");
      playUrl(cached);
      return;
    }

    setPreviewState("loading");
    try {
      const result = await previewVoiceSampleAction({ voiceCode, text: sampleText });
      if (!result.ok) {
        setPreviewState("error");
        setPreviewError(result.error.message);
        return;
      }
      previewCacheRef.current.set(cacheKey, result.data.dataUrl);
      playUrl(result.data.dataUrl);
    } catch {
      setPreviewState("error");
      setPreviewError("Đã có lỗi xảy ra khi tạo đoạn nghe thử.");
    }
  }

  async function handleGenerate() {
    if (busy || !brandId || !text.trim() || textOverLimit || !voiceCode) return;
    setGenerating(true);
    setJob(null);
    try {
      const result = await createVoiceGenerationAction({
        brandId,
        text,
        voiceCode,
        voiceName: selectedVoice?.name ?? "",
        outputFormat,
        bitrate,
        speed,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const fetched = await getVoiceGenerationStatusAction(result.data.jobId);
      if (fetched) setJob(fetched);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!job || job.status !== "succeeded" || saving) return;
    setSaving(true);
    try {
      const result = await saveVoiceAssetAction({ jobId: job.id, name: job.text.slice(0, 80) });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setJob({ ...job, savedAssetId: result.data.assetId });
      toast.success("Đã lưu vào thư viện.");
    } finally {
      setSaving(false);
    }
  }

  if (!voicesResult.ok) {
    return (
      <Card>
        <CardContent className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            {voicesResult.code === "NOT_CONFIGURED"
              ? "Chưa cấu hình VBEE_APP_ID/VBEE_TOKEN trên server — liên hệ Admin để thêm biến môi trường rồi tải lại trang."
              : `Không tải được danh sách giọng đọc từ Vbee: ${voicesResult.message}`}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nội dung & giọng đọc</CardTitle>
          <CardDescription>Nhập văn bản cần chuyển thành giọng nói và chọn giọng đọc.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Thương hiệu</Label>
            <BrandPicker brands={brands} value={brandId} onChange={setBrandId} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="voice-text" className="text-xs">
              Văn bản
            </Label>
            <Textarea
              id="voice-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nhập văn bản cần chuyển thành giọng nói..."
              rows={6}
              maxLength={maxChars}
              aria-invalid={textOverLimit}
              disabled={busy}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {willUseSync
                  ? "Văn bản ngắn + giọng hỗ trợ tức thời — sẽ xử lý đồng bộ (API Realtime), có kết quả ngay."
                  : "Sẽ xử lý bất đồng bộ (Batch API) — có thể mất vài chục giây đến vài phút tuỳ độ dài."}
              </p>
              <CharCounter current={text.length} max={maxChars} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Giọng đọc</Label>
              <Select value={voiceCode} onValueChange={(v) => v && handleVoiceChange(v)}>
                <SelectTrigger className="w-full" disabled={busy}>
                  <SelectValue placeholder="Chọn giọng đọc">
                    {() =>
                      selectedVoice ? (
                        <span className="flex items-center gap-2">
                          <VoiceAvatar voice={selectedVoice} className="size-5 text-[10px]" />
                          <span>{selectedVoice.name}</span>
                        </span>
                      ) : (
                        "Chọn giọng đọc"
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {voices.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Không có giọng nào khả dụng.</div>
                  )}
                  {voices.map((v) => (
                    <SelectItem key={v.code} value={v.code}>
                      <span className="flex items-center gap-2 py-0.5">
                        <VoiceAvatar voice={v} />
                        <span className="flex flex-col">
                          <span>{v.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {v.gender === "female" ? "Nữ" : v.gender === "male" ? "Nam" : v.gender}
                            {(VBEE_SYNC_VOICE_CODES as readonly string[]).includes(v.code) ? " · Hỗ trợ tức thời" : ""}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedVoice && (
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={previewState === "loading"}
                    onClick={handlePreview}
                  >
                    {previewState === "loading" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : previewState === "playing" ? (
                      <Pause className="size-3.5" />
                    ) : previewState === "error" ? (
                      <AlertTriangle className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    {previewState === "loading"
                      ? "Đang tải..."
                      : previewState === "playing"
                        ? "Tạm dừng"
                        : "Nghe thử"}
                  </Button>
                  <p className="flex items-start gap-1 text-xs text-muted-foreground">
                    <Volume2 className="size-3 shrink-0 mt-0.5" />
                    {text.trim() && isSyncEligible
                      ? `Nghe thử sẽ đọc ${Math.min(text.trim().length, VBEE_PREVIEW_SAMPLE_MAX_CHARS)}/${text.trim().length} ký tự đầu văn bản của bạn bằng giọng này — gọi API Vbee, có thể tính vào hạn mức sử dụng.`
                      : text.trim() && !isSyncEligible
                        ? selectedVoice.demoUrl
                          ? "Giọng này không hỗ trợ nghe thử theo nội dung tùy chỉnh — sẽ phát mẫu giọng có sẵn của Vbee thay thế."
                          : "Giọng này không hỗ trợ nghe thử theo nội dung tùy chỉnh và cũng chưa có audio mẫu."
                        : selectedVoice.demoUrl
                          ? "Chưa nhập văn bản — nghe thử sẽ phát mẫu giọng có sẵn của Vbee (miễn phí)."
                          : isSyncEligible
                            ? "Chưa nhập văn bản — nghe thử sẽ gọi API Vbee để đọc một câu mẫu ngắn (có thể tính vào hạn mức sử dụng)."
                            : "Giọng này chưa có audio mẫu và không hỗ trợ nghe thử tức thời."}
                  </p>
                  {previewState === "error" && previewError && (
                    <p className="flex items-start gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3 shrink-0 mt-0.5" />
                      {previewError}
                    </p>
                  )}
                  <audio
                    ref={previewAudioRef}
                    className="hidden"
                    onPlaying={() => setPreviewState("playing")}
                    onEnded={() => setPreviewState("idle")}
                    onPause={() => setPreviewState((s) => (s === "playing" ? "idle" : s))}
                    onError={() => {
                      setPreviewState("error");
                      setPreviewError("Không thể phát audio mẫu.");
                    }}
                  >
                    <track kind="captions" />
                  </audio>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Định dạng</Label>
              <Select value={outputFormat} onValueChange={(v) => v && setOutputFormat(v as "mp3" | "wav")}>
                <SelectTrigger className="w-full" disabled={busy}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VBEE_OUTPUT_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Tốc độ đọc</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={1.9}
                step={0.05}
                value={speed}
                disabled={busy}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Bitrate (kbps)</Label>
              <Select value={String(bitrate)} onValueChange={(v) => v && setBitrate(Number(v) as (typeof VBEE_VALID_BITRATES)[number])}>
                <SelectTrigger className="w-full" disabled={busy}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VBEE_VALID_BITRATES.map((b) => (
                    <SelectItem key={b} value={String(b)}>
                      {b} kbps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            disabled={busy || !brandId || !text.trim() || textOverLimit || !voiceCode}
            onClick={handleGenerate}
            className="w-fit"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Đang gửi yêu cầu..." : job?.status === "processing" ? "Đang xử lý..." : "Tạo audio"}
          </Button>
        </CardContent>
      </Card>

      {job && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kết quả</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {job.status === "processing" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {job.mode === "async" ? "Đang xử lý qua Batch API — có thể mất một lúc..." : "Đang xử lý..."}
              </p>
            )}

            {job.status === "failed" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{job.error || "Tạo audio thất bại — không rõ nguyên nhân."}</span>
              </div>
            )}

            {job.status === "succeeded" && job.audioUrl && (
              <>
                <audio controls src={job.audioUrl} className="w-full">
                  <track kind="captions" />
                </audio>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={job.audioUrl} download />}
                  >
                    <Download className="size-3.5" />
                    Tải xuống
                  </Button>
                  {job.savedAssetId ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <Check className="size-3.5" />
                      Đã lưu vào thư viện
                    </span>
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={handleSave}>
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      Lưu vào thư viện
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
