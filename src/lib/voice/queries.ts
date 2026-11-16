import { createClient } from "@/lib/supabase/server";
import { resolveSignedAssetUrl } from "@/lib/generation/storage";
import type { VoiceGenerationJob } from "@/types/voice";

type VoiceGenerationJobRow = {
  id: string;
  text: string;
  voice_code: string;
  voice_name: string;
  mode: "sync" | "async";
  output_format: "mp3" | "wav";
  bitrate: number;
  speed: number;
  status: VoiceGenerationJob["status"];
  error: string | null;
  storage_path: string | null;
  created_at: string;
};

async function toVoiceGenerationJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: VoiceGenerationJobRow
): Promise<VoiceGenerationJob> {
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

/** RLS ("own voice generation jobs select") already scopes this to the
 * caller's own rows — same convention as getGenerationJob. */
export async function getVoiceGenerationJob(jobId: string): Promise<VoiceGenerationJob | null> {
  const supabase = await createClient();
  const { data: job, error } = await supabase.from("voice_generation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !job) {
    if (error) console.error("[getVoiceGenerationJob]", error);
    return null;
  }

  return toVoiceGenerationJob(supabase, job);
}

/** History list for the "/create/voice" page's "Danh sách voice đã tạo
 * trước đó" section — RLS already scopes to the caller's own rows, same
 * as getVoiceGenerationJob; also scoped to the active workspace so a user
 * in multiple workspaces never sees another workspace's jobs mixed in,
 * ordered newest-first via the existing idx_voice_generation_jobs_user
 * (user_id, created_at desc) index. */
export async function listVoiceGenerationJobs(workspaceId: string, limit = 20): Promise<VoiceGenerationJob[]> {
  const supabase = await createClient();
  const { data: jobs, error } = await supabase
    .from("voice_generation_jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !jobs) {
    if (error) console.error("[listVoiceGenerationJobs]", error);
    return [];
  }

  return Promise.all(jobs.map((job) => toVoiceGenerationJob(supabase, job)));
}
