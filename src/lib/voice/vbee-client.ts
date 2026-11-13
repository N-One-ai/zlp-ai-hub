// Server-only by convention (same as every other lib/*/storage.ts and
// provider client in this app) — never imported from a Client Component,
// since authHeaders() below reads the secret VBEE_APP_ID/VBEE_TOKEN env
// vars directly.
import type { VbeeVoice } from "@/types/voice";

const TTS_BASE = "https://api.vbee.vn/v1/tts";
const VOICES_BASE = "https://vbee.vn/api/public/v1/voices";

export class VbeeError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** True only when both server-only credentials are actually set — every
 * caller checks this first and fails with an honest "chưa cấu hình"
 * message instead of sending a request that can only 401. Never read
 * client-side (this file is server-only, see the "server-only" import
 * above — importing it from a Client Component is a build error). */
export function isVbeeConfigured(): boolean {
  return Boolean(process.env.VBEE_APP_ID && process.env.VBEE_TOKEN);
}

function authHeaders(): Record<string, string> {
  const appId = process.env.VBEE_APP_ID;
  const token = process.env.VBEE_TOKEN;
  if (!appId || !token) {
    throw new VbeeError("NOT_CONFIGURED", "Chưa cấu hình VBEE_APP_ID/VBEE_TOKEN trên server.", 500);
  }
  return { Authorization: `Bearer ${token}`, "App-Id": appId };
}

/** Parses Vbee's documented error shape ({ error: { code, message } })
 * without ever assuming it — falls back to a generic message keyed off
 * the real HTTP status when the body doesn't match, since a 5xx from an
 * upstream outage may not be JSON at all. */
async function parseErrorResponse(res: Response): Promise<VbeeError> {
  let code = "UNKNOWN";
  let message = `Vbee trả về lỗi HTTP ${res.status}.`;
  try {
    const body = await res.json();
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // body wasn't JSON — keep the generic HTTP-status message
  }
  return new VbeeError(code, message, res.status);
}

export async function listVbeeVoices(params: { languageCode?: string; limit?: number; cursor?: string } = {}): Promise<{
  voices: VbeeVoice[];
  nextCursor: string | null;
}> {
  const url = new URL(VOICES_BASE);
  url.searchParams.set("voiceOwnership", "VBEE");
  if (params.languageCode) url.searchParams.set("languageCode", params.languageCode);
  url.searchParams.set("limit", String(params.limit ?? 100));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  const res = await fetch(url.toString(), { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw await parseErrorResponse(res);
  const body = await res.json();
  const voices: VbeeVoice[] = (body?.result?.voices ?? []).map((v: Record<string, unknown>) => ({
    code: String(v.code),
    name: String(v.name),
    gender: String(v.gender ?? ""),
    languageCode: String(v.language_code ?? ""),
    demoUrl: typeof v.demo === "string" ? v.demo : null,
  }));
  return { voices, nextCursor: body?.result?.pagination?.next_cursor ?? null };
}

export interface VbeeTtsInput {
  text: string;
  voiceCode: string;
  outputFormat: "mp3" | "wav";
  bitrate: number;
  speed: number;
  sampleRate?: number;
}

/** Realtime (sync) API — text <= 300 chars, a 5-voice whitelist only (see
 * VBEE_SYNC_VOICE_CODES). Returns the raw audio bytes directly: the
 * endpoint streams binary chunks (no JSON envelope) on success, and a
 * JSON `{ error }` body on failure — distinguished here by content-type,
 * never by guessing from the byte size. */
export async function createVbeeSyncTts(input: VbeeTtsInput): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(TTS_BASE, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      mode: "sync",
      voiceCode: input.voiceCode,
      outputFormat: input.outputFormat,
      bitrate: input.bitrate,
      speed: input.speed,
      ...(input.sampleRate ? { sampleRate: input.sampleRate } : {}),
    }),
  });

  const rawContentType = res.headers.get("content-type") ?? "";
  if (!res.ok || rawContentType.includes("application/json")) {
    throw await parseErrorResponse(res);
  }
  const arrayBuffer = await res.arrayBuffer();
  // Same reasoning as downloadVbeeAudio below: trust what we ASKED FOR
  // (input.outputFormat), not the header — confirmed live that Vbee's
  // own infra can report a generic content-type that Supabase Storage's
  // mime allow-list then rejects.
  const contentType = input.outputFormat === "wav" ? "audio/wav" : "audio/mpeg";
  return { bytes: Buffer.from(arrayBuffer), contentType };
}

/** Batch (async) API — up to 100,000 chars, any voice. `webhookUrl` is a
 * REQUIRED field per the docs (not optional) even though this app's own
 * polling fallback (see lib/voice/actions.ts) never actually depends on
 * it firing — it's still wired to a real endpoint
 * (/api/integrations/vbee/callback) so it works correctly wherever this
 * app is deployed with a public URL. */
export async function createVbeeBatchTts(
  input: VbeeTtsInput & { webhookUrl: string }
): Promise<{ requestId: string; status: string }> {
  const res = await fetch(TTS_BASE, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      mode: "async",
      voiceCode: input.voiceCode,
      outputFormat: input.outputFormat,
      bitrate: input.bitrate,
      speed: input.speed,
      webhookUrl: input.webhookUrl,
      ...(input.sampleRate ? { sampleRate: input.sampleRate } : {}),
    }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  const body = await res.json();
  return { requestId: body.requestId, status: body.status };
}

export async function getVbeeTtsRequest(
  requestId: string
): Promise<{ status: string; audioLink: string | null }> {
  const res = await fetch(`${TTS_BASE}/requests/${encodeURIComponent(requestId)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw await parseErrorResponse(res);
  const body = await res.json();
  return { status: body.status, audioLink: body.audioLink ?? null };
}

/** Downloads Vbee's own short-lived audio link SERVER-SIDE, immediately —
 * both the Batch docs ("audio link chỉ có thời hạn 3 phút") and this
 * app's own PRD requirement say this link must never be stored as a
 * lasting asset URL. Called from both the webhook route and the polling
 * fallback, whichever notices completion first.
 *
 * `expectedFormat` (the SAME "mp3"/"wav" this app requested when
 * creating the job — job.output_format / the callback's own audio_type
 * field) always wins over whatever Content-Type the response itself
 * reports — confirmed live that Vbee's storage CDN serves the file as a
 * generic `application/octet-stream`, which Supabase Storage's
 * allowed_mime_types check then rejects outright. The request's own
 * requested format is the one piece of truth we already know for
 * certain; the HTTP header is not. */
export async function downloadVbeeAudio(
  url: string,
  expectedFormat: "mp3" | "wav"
): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new VbeeError("DOWNLOAD_FAILED", `Không tải được audio từ Vbee (HTTP ${res.status}).`, res.status);
  const contentType = expectedFormat === "wav" ? "audio/wav" : "audio/mpeg";
  const arrayBuffer = await res.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), contentType };
}
