import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCreativeAssetPath, uploadGeneratedImage, extensionForContentType } from "@/lib/generation/storage";
import { downloadVbeeAudio } from "@/lib/voice/vbee-client";

/**
 * Vbee's Batch API callback (api-docs.vbee.vn/vbee-api/text-to-speech/
 * callback-api) — POSTs here with NO signed-in user at all, so this uses
 * the service-role client (never lib/supabase/server.ts, which assumes a
 * session to scope RLS by). Matches the job by `request_id` (our own
 * `voice_generation_jobs.vbee_request_id`), not by trusting any user
 * identity in the body.
 *
 * This is one of TWO ways a processing job gets resolved — the other is
 * the client-side polling fallback in lib/voice/actions.ts
 * (getVoiceGenerationStatusAction), which exists precisely because this
 * route is unreachable from a local/non-public dev environment. Both
 * paths are idempotent: whichever notices completion first downloads the
 * (short-lived) audio_link and flips the row to a terminal status: the
 * other either finds nothing to do (loses the SELECT race honestly) or
 * just overwrites the same already-correct terminal state.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestId = typeof body.request_id === "string" ? body.request_id : null;
  const status = typeof body.status === "string" ? body.status : null;
  const audioLink = typeof body.audio_link === "string" ? body.audio_link : null;
  const appId = typeof body.app_id === "string" ? body.app_id : null;

  if (!requestId || !status) {
    return NextResponse.json({ error: "Missing request_id or status" }, { status: 400 });
  }
  // Loose authenticity check — Vbee's callback carries app_id in the
  // body (no signature scheme is documented), so this at least rejects a
  // callback claiming to be from a DIFFERENT app than the one this
  // server is configured for, rather than trusting request_id alone.
  if (appId && process.env.VBEE_APP_ID && appId !== process.env.VBEE_APP_ID) {
    return NextResponse.json({ error: "app_id mismatch" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("voice_generation_jobs")
    .select("id, workspace_id, brand_id, status, output_format")
    .eq("vbee_request_id", requestId)
    .maybeSingle();

  if (!job) {
    // Not an error from Vbee's point of view — just a request_id this
    // app doesn't recognize (e.g. already deleted, or a stale retry).
    return NextResponse.json({ ok: true, note: "unknown request_id" });
  }
  if (job.status !== "processing") {
    return NextResponse.json({ ok: true, note: "already resolved" });
  }

  if (status === "SUCCESS" && audioLink) {
    try {
      const { bytes, contentType } = await downloadVbeeAudio(audioLink, job.output_format);
      const path = buildCreativeAssetPath(job.workspace_id, job.brand_id, extensionForContentType(contentType));
      const { error: uploadError } = await uploadGeneratedImage(supabase, path, bytes, contentType);
      if (uploadError) throw new Error(uploadError.message);
      await supabase.from("voice_generation_jobs").update({ status: "succeeded", storage_path: path }).eq("id", job.id);
    } catch (e) {
      console.error("[vbee callback] download/store failed", e instanceof Error ? e.message : e);
      await supabase
        .from("voice_generation_jobs")
        .update({ status: "failed", error: "Không tải/lưu được audio từ Vbee." })
        .eq("id", job.id);
    }
  } else {
    await supabase
      .from("voice_generation_jobs")
      .update({ status: "failed", error: `Vbee báo trạng thái: ${status}` })
      .eq("id", job.id);
  }

  return NextResponse.json({ ok: true });
}
