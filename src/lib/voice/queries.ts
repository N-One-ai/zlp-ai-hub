import { createClient } from "@/lib/supabase/server";
import { resolveSignedAssetUrl } from "@/lib/generation/storage";
import type { VoiceGenerationJob } from "@/types/voice";

/** RLS ("own voice generation jobs select") already scopes this to the
 * caller's own rows — same convention as getGenerationJob. */
export async function getVoiceGenerationJob(jobId: string): Promise<VoiceGenerationJob | null> {
  const supabase = await createClient();
  const { data: job, error } = await supabase.from("voice_generation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) {
    if (error) console.error("[getVoiceGenerationJob]", error);
    return null;
  }

  const [{ data: savedAsset }, audioUrl] = await Promise.all([
    supabase.from("creative_assets").select("id").eq("storage_path", job.storage_path ?? "__none__").maybeSingle(),
    resolveSignedAssetUrl(supabase, job.storage_path),
  ]);

  return {
    id: job.id,
    text: job.text,
    voiceCode: job.voice_code,
    voiceName: job.voice_name,
    mode: job.mode,
    outputFormat: job.output_format,
    bitrate: job.bitrate,
    speed: job.speed,
    status: job.status,
    error: job.error,
    audioUrl,
    savedAssetId: savedAsset?.id ?? null,
    createdAt: job.created_at,
  };
}
