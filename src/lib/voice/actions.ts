"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { getActiveWorkspace } from "@/lib/workspace/queries";
import { trackEvent } from "@/lib/analytics/track";
import { buildCreativeAssetPath, uploadGeneratedImage, extensionForContentType } from "@/lib/generation/storage";
import { createVoiceGenerationSchema, saveVoiceAssetSchema, previewVoiceSampleSchema } from "./schema";
import { getVoiceGenerationJob } from "./queries";
import {
  isVbeeConfigured,
  listVbeeVoices,
  createVbeeSyncTts,
  createVbeeBatchTts,
  getVbeeTtsRequest,
  downloadVbeeAudio,
  VbeeError,
} from "./vbee-client";
import { VBEE_SYNC_VOICE_CODES, VBEE_SYNC_MAX_CHARS } from "@/types/voice";
import type { VbeeVoice, VoiceGenerationJob } from "@/types/voice";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";
// A double-click or an accidental resubmit within this window reuses the
// in-flight job instead of creating a duplicate — same idempotency window
// convention as generateImages() (lib/generation/actions.ts).
const IDEMPOTENCY_WINDOW_MS = 15_000;

/** "Chưa cấu hình VBEE_APP_ID/VBEE_TOKEN" is always distinguishable from
 * every other error — the page checks this BEFORE rendering the voice
 * picker/text form, so the UI never shows a feature it can't actually
 * run (never a hardcoded/fake voice list either). */
export async function isVbeeConfiguredAction(): Promise<boolean> {
  return isVbeeConfigured();
}

/** Server-resolved Vietnamese voice list, live from Vbee's own API —
 * paginates through every page itself (the API caps a single page at
 * 100) rather than exposing cursor plumbing to the client, since the
 * full vi-VN catalog is small enough to fetch in one request round-trip.
 * Never hardcodes a voiceCode: if this call fails, the picker shows the
 * real error instead of falling back to a guessed list. */
export async function getVbeeVoicesAction(): Promise<ActionResult<VbeeVoice[]>> {
  if (!isVbeeConfigured()) {
    return err("NOT_CONFIGURED", "Chưa cấu hình VBEE_APP_ID/VBEE_TOKEN — liên hệ Admin để thêm biến môi trường.");
  }
  try {
    const voices: VbeeVoice[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await listVbeeVoices({ languageCode: "vi-VN", limit: 100, cursor });
      voices.push(...result.voices);
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
    return ok(voices);
  } catch (e) {
    const message = e instanceof VbeeError ? e.message : GENERIC_ERROR;
    return err(e instanceof VbeeError ? e.code : "UNKNOWN", message);
  }
}

function buildWebhookUrl(requestHeaders: Headers): string {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/integrations/vbee/callback`;
}

/**
 * Creates a Vbee TTS job — picks Realtime (sync) vs Batch (async) from
 * the REAL documented constraints (text length AND the sync API's fixed
 * 5-voice whitelist), never a guess. Sync resolves (and stores the
 * audio) within this one call; async returns immediately with status
 * 'processing' and the client polls getVoiceGenerationStatusAction.
 */
export async function createVoiceGenerationAction(rawInput: unknown): Promise<ActionResult<{ jobId: string }>> {
  const parsed = createVoiceGenerationSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  if (!isVbeeConfigured()) {
    return err("NOT_CONFIGURED", "Chưa cấu hình VBEE_APP_ID/VBEE_TOKEN — liên hệ Admin để thêm biến môi trường.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const workspace = await getActiveWorkspace();
  if (!workspace) return err("FORBIDDEN", "Không tìm thấy workspace.");

  const mode: "sync" | "async" =
    input.text.length <= VBEE_SYNC_MAX_CHARS && (VBEE_SYNC_VOICE_CODES as readonly string[]).includes(input.voiceCode)
      ? "sync"
      : "async";

  // Anti-double-submit: reuse a still-processing job with the exact same
  // text/voice/config created moments ago instead of starting a second
  // one — covers a double-click or a stray repeated request.
  const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString();
  const { data: recent } = await supabase
    .from("voice_generation_jobs")
    .select("id, text, voice_code, output_format, bitrate, speed")
    .eq("user_id", user.id)
    .eq("brand_id", input.brandId)
    .eq("status", "processing")
    .gte("created_at", since);
  const duplicate = (recent ?? []).find(
    (j) =>
      j.text === input.text &&
      j.voice_code === input.voiceCode &&
      j.output_format === input.outputFormat &&
      j.bitrate === input.bitrate &&
      Math.abs(j.speed - input.speed) < 0.001
  );
  if (duplicate) return ok({ jobId: duplicate.id });

  const { data: jobRow, error: insertError } = await supabase
    .from("voice_generation_jobs")
    .insert({
      workspace_id: workspace.workspaceId,
      brand_id: input.brandId,
      user_id: user.id,
      text: input.text,
      voice_code: input.voiceCode,
      voice_name: input.voiceName,
      mode,
      output_format: input.outputFormat,
      bitrate: input.bitrate,
      speed: input.speed,
      sample_rate: input.sampleRate ?? null,
    })
    .select("id")
    .single();

  if (insertError || !jobRow) {
    console.error("[createVoiceGenerationAction] insert", insertError);
    return err("DB_ERROR", "Không thể tạo tác vụ tạo giọng nói.");
  }

  await trackEvent({ name: "voice_generation_started", brandId: input.brandId, mode });

  try {
    if (mode === "sync") {
      const { bytes, contentType } = await createVbeeSyncTts({
        text: input.text,
        voiceCode: input.voiceCode,
        outputFormat: input.outputFormat,
        bitrate: input.bitrate,
        speed: input.speed,
        sampleRate: input.sampleRate,
      });
      const path = buildCreativeAssetPath(workspace.workspaceId, input.brandId, extensionForContentType(contentType));
      const { error: uploadError } = await uploadGeneratedImage(supabase, path, bytes, contentType);
      if (uploadError) throw new Error(`Lưu file thất bại: ${uploadError.message}`);

      await supabase.from("voice_generation_jobs").update({ status: "succeeded", storage_path: path }).eq("id", jobRow.id);
      await trackEvent({ name: "voice_generation_succeeded", jobId: jobRow.id, mode });
    } else {
      const webhookUrl = buildWebhookUrl(await headers());
      const { requestId } = await createVbeeBatchTts({
        text: input.text,
        voiceCode: input.voiceCode,
        outputFormat: input.outputFormat,
        bitrate: input.bitrate,
        speed: input.speed,
        sampleRate: input.sampleRate,
        webhookUrl,
      });
      await supabase.from("voice_generation_jobs").update({ vbee_request_id: requestId }).eq("id", jobRow.id);
    }
  } catch (e) {
    const message = e instanceof VbeeError ? e.message : e instanceof Error ? e.message : GENERIC_ERROR;
    const code = e instanceof VbeeError ? e.code : "UNKNOWN";
    await supabase.from("voice_generation_jobs").update({ status: "failed", error: message }).eq("id", jobRow.id);
    await trackEvent({ name: "voice_generation_failed", jobId: jobRow.id, errorCode: code });
    // Still return ok() with the jobId — the job row itself records the
    // failure, and the client reads the real error from there (same
    // "always resolve to a real job row, never throw past this action"
    // shape as generateImages()'s own callers expect).
  }

  return ok({ jobId: jobRow.id });
}

/**
 * Client polling for an 'async' job — the resilient fallback that works
 * even when the webhook (/api/integrations/vbee/callback) can't reach
 * this app (e.g. local dev, no public URL). If our own row still says
 * 'processing' but Vbee's Get Request API says COMPLETED/FAILED, this
 * downloads the (short-lived) audioLink immediately and updates the row
 * itself — so a second poll a moment later, or the webhook firing late,
 * both see an already-terminal job and do nothing further.
 */
export async function getVoiceGenerationStatusAction(jobId: string): Promise<VoiceGenerationJob | null> {
  const job = await getVoiceGenerationJob(jobId);
  if (!job || job.status !== "processing" || job.mode !== "async") return job;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("voice_generation_jobs")
    .select("vbee_request_id, status, workspace_id, brand_id, output_format")
    .eq("id", jobId)
    .maybeSingle();
  if (!row?.vbee_request_id || row.status !== "processing") return job;

  try {
    const result = await getVbeeTtsRequest(row.vbee_request_id);
    if (result.status === "PROCESSING" || result.status === "QUEUED") return job;

    if (result.status === "COMPLETED" && result.audioLink) {
      const { bytes, contentType } = await downloadVbeeAudio(result.audioLink, row.output_format);
      const path = buildCreativeAssetPath(row.workspace_id, row.brand_id, extensionForContentType(contentType));
      const { error: uploadError } = await uploadGeneratedImage(supabase, path, bytes, contentType);
      if (uploadError) throw new Error(`Lưu file thất bại: ${uploadError.message}`);
      await supabase.from("voice_generation_jobs").update({ status: "succeeded", storage_path: path }).eq("id", jobId);
      await trackEvent({ name: "voice_generation_succeeded", jobId, mode: "async" });
    } else {
      await supabase
        .from("voice_generation_jobs")
        .update({ status: "failed", error: `Vbee báo trạng thái: ${result.status}` })
        .eq("id", jobId);
      await trackEvent({ name: "voice_generation_failed", jobId, errorCode: result.status });
    }
  } catch (e) {
    const message = e instanceof VbeeError ? e.message : e instanceof Error ? e.message : GENERIC_ERROR;
    // A transient poll failure (network blip to Vbee) does NOT mark the
    // job failed — only a real terminal status from Vbee does. The next
    // poll just tries again.
    console.error("[getVoiceGenerationStatusAction] poll", message);
    return job;
  }

  return getVoiceGenerationJob(jobId);
}

/** Registers an already-succeeded job's (already-stored) audio file as a
 * real Thư viện asset — mirrors saveGenerationResult's own separation:
 * the file was already downloaded/stored the moment the job succeeded,
 * this call only ever creates the creative_assets ROW, never fetches or
 * re-uploads anything. */
export async function saveVoiceAssetAction(rawInput: unknown): Promise<ActionResult<{ assetId: string }>> {
  const parsed = saveVoiceAssetSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { jobId, name } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: job, error: jobError } = await supabase
    .from("voice_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !job) return err("NOT_FOUND", "Không tìm thấy tác vụ.");
  if (job.status !== "succeeded" || !job.storage_path) return err("INVALID_STATE", "Tác vụ chưa có audio để lưu.");

  const { data: existing } = await supabase.from("creative_assets").select("id").eq("storage_path", job.storage_path).maybeSingle();
  if (existing) return ok({ assetId: existing.id });

  const { data: asset, error: insertError } = await supabase
    .from("creative_assets")
    .insert({
      workspace_id: job.workspace_id,
      brand_id: job.brand_id,
      owner_id: user.id,
      type: "audio",
      name: name || job.text.slice(0, 80),
      status: "ready",
      storage_path: job.storage_path,
      prompt: job.text,
    })
    .select("id")
    .single();

  if (insertError || !asset) {
    console.error("[saveVoiceAssetAction] insert", insertError);
    return err("DB_ERROR", "Không thể lưu vào thư viện.");
  }

  return ok({ assetId: asset.id });
}

/**
 * Fallback-only "Nghe thử" path — used ONLY when the selected voice has
 * no `demoUrl` from Vbee's own voices list. Calls the Realtime (sync) API
 * directly with a short, already-capped excerpt (see
 * VBEE_PREVIEW_SAMPLE_MAX_CHARS / previewVoiceSampleSchema) and returns
 * the audio as an ephemeral base64 data URL.
 *
 * Deliberately never touches voice_generation_jobs or creative_assets —
 * a preview must never be mistaken for, or silently become, a saved
 * generation product. This DOES call the same billable Vbee endpoint as
 * a real generation (disclosed in the UI next to the button), unlike the
 * primary demoUrl-playback path which is free/instant and needs no
 * server call at all.
 */
export async function previewVoiceSampleAction(rawInput: unknown): Promise<ActionResult<{ dataUrl: string }>> {
  const parsed = previewVoiceSampleSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { voiceCode, text } = parsed.data;

  if (!isVbeeConfigured()) {
    return err("NOT_CONFIGURED", "Chưa cấu hình VBEE_APP_ID/VBEE_TOKEN — liên hệ Admin để thêm biến môi trường.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  if (!(VBEE_SYNC_VOICE_CODES as readonly string[]).includes(voiceCode)) {
    return err(
      "SYNC_NOT_SUPPORTED",
      "Giọng này không hỗ trợ nghe thử tức thời (API Realtime chỉ hỗ trợ 5 giọng cố định)."
    );
  }

  try {
    const { bytes, contentType } = await createVbeeSyncTts({
      text,
      voiceCode,
      outputFormat: "mp3",
      bitrate: 64,
      speed: 1.0,
    });
    return ok({ dataUrl: `data:${contentType};base64,${bytes.toString("base64")}` });
  } catch (e) {
    const message = e instanceof VbeeError ? e.message : e instanceof Error ? e.message : GENERIC_ERROR;
    const code = e instanceof VbeeError ? e.code : "UNKNOWN";
    return err(code, message);
  }
}
