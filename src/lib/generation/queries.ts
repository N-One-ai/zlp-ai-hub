import { createClient } from "@/lib/supabase/server";
import { resolveSignedAssetUrl } from "./storage";
import type { GenerationJob, GenerationResultItem } from "@/types/generation";

export interface IncompleteJobSummary {
  id: string;
  prompt: string;
  status: "queued" | "processing";
  createdAt: string;
}

/** Dashboard's "job chưa hoàn tất" — the current user's own in-flight
 * jobs (RLS already scopes generation_jobs to owner-only). */
export async function getIncompleteJobs(): Promise<IncompleteJobSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id, prompt, status, created_at")
    .eq("user_id", user.id)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[getIncompleteJobs]", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    prompt: row.prompt,
    status: row.status as "queued" | "processing",
    createdAt: row.created_at,
  }));
}

/** Plain reads for Server Components — not Server Actions. RLS
 * ("own generation jobs") already scopes this to the caller's own jobs. */
export async function getGenerationJob(jobId: string): Promise<GenerationJob | null> {
  const supabase = await createClient();

  const { data: job, error } = await supabase.from("generation_jobs").select("*").eq("id", jobId).maybeSingle();

  if (error || !job) {
    if (error) console.error("[getGenerationJob]", error);
    return null;
  }

  // Match already-saved outputs by storage path — saving a result reuses
  // the SAME uploaded file as its creative_assets.storage_path (no
  // re-upload), so this join is enough to know which variants are saved
  // without a separate linking column.
  const { data: savedAssets } = await supabase
    .from("creative_assets")
    .select("id, storage_path")
    .eq("source_generation_job_id", jobId);

  const savedByPath = new Map((savedAssets ?? []).map((a) => [a.storage_path, a.id]));

  const results: GenerationResultItem[] = await Promise.all(
    job.output.map(async (item, index) => ({
      index,
      url: await resolveSignedAssetUrl(supabase, item.path),
      width: item.width,
      height: item.height,
      isDemo: item.isDemo,
      savedAssetId: savedByPath.get(item.path) ?? null,
    }))
  );

  return {
    id: job.id,
    brandId: job.brand_id,
    prompt: job.prompt,
    negativePrompt: job.negative_prompt,
    width: job.params.width,
    height: job.params.height,
    count: job.params.count,
    provider: job.provider,
    requestedModel: job.requested_model ?? "auto",
    finalModel: job.final_model,
    attempts: job.attempts,
    status: job.status,
    error: job.error,
    results,
    createdAt: job.created_at,
  };
}

export interface GeneratedImageGalleryItem {
  id: string;
  thumbnailUrl: string | null;
  prompt: string | null;
  width: number | null;
  height: number | null;
  requestedModel: string | null;
  finalModel: string | null;
  createdAt: string;
}

/** The Tạo ảnh page's own gallery — every image that came out of a real
 * generation (source_generation_job_id set), workspace-wide, newest
 * first. Deliberately separate from getLibraryAssets()/LibraryAssetListItem
 * (used by Thư viện and Dashboard) rather than extending that shared
 * type — this page needs prompt/model/size per item for "Tạo biến thể",
 * which Thư viện's list view has no use for, so adding it there would be
 * unrelated scope creep onto a shared, already-used type. */
export async function getGeneratedImageGallery(workspaceId: string, limit = 60): Promise<GeneratedImageGalleryItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creative_assets")
    .select("id, storage_path, prompt, width, height, created_at, generation_jobs(requested_model, final_model)")
    .eq("workspace_id", workspaceId)
    .eq("type", "image")
    .not("source_generation_job_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("[getGeneratedImageGallery]", error);
    return [];
  }

  const rows = data as unknown as {
    id: string;
    storage_path: string | null;
    prompt: string | null;
    width: number | null;
    height: number | null;
    created_at: string;
    generation_jobs: { requested_model: string | null; final_model: string | null } | null;
  }[];

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      thumbnailUrl: await resolveSignedAssetUrl(supabase, row.storage_path),
      prompt: row.prompt,
      width: row.width,
      height: row.height,
      requestedModel: row.generation_jobs?.requested_model ?? null,
      finalModel: row.generation_jobs?.final_model ?? null,
      createdAt: row.created_at,
    }))
  );
}
