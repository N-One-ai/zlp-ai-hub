"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { generateImageInputSchema, saveResultSchema } from "./schema";
import { getImageProvider } from "./providers";
import { buildCreativeAssetPath, uploadGeneratedImage, extensionForContentType } from "./storage";
import { getActiveWorkspace } from "@/lib/workspace/queries";
import { getGenerationJob } from "./queries";
import { trackEvent } from "@/lib/analytics/track";
import type { GenerationOutputItem } from "@/types/database";
import type { GenerationJob } from "@/types/generation";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function aspectRatioLabel(width: number, height: number): string {
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}

/**
 * Creates a job row and processes it SYNCHRONOUSLY within this same
 * Server Action (see migration 0004's comment on generation_jobs — there
 * is no separate background worker in Phase 1). Still writes through the
 * full queued -> processing -> succeeded/failed lifecycle so the UI and
 * schema are already correct for when a slower real provider is wired in
 * later (Task 3.4).
 */
export async function generateImages(rawInput: unknown): Promise<ActionResult<{ jobId: string }>> {
  const parsed = generateImageInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const workspace = await getActiveWorkspace();
  if (!workspace) return err("FORBIDDEN", "Không tìm thấy workspace.");

  const { data: preset, error: presetError } = await supabase
    .from("size_presets")
    .select("width, height")
    .eq("id", input.sizePresetId)
    .maybeSingle();

  if (presetError || !preset) {
    return err("VALIDATION_ERROR", "Preset kích thước không hợp lệ.");
  }

  // Insert as 'queued' — RLS ("own generation jobs") independently
  // re-checks user_id = auth.uid() and is_workspace_contributor(), so a
  // Viewer calling this directly would be rejected at the database, not
  // just blocked by the UI not showing the form.
  const { data: job, error: insertError } = await supabase
    .from("generation_jobs")
    .insert({
      workspace_id: workspace.workspaceId,
      brand_id: input.brandId,
      user_id: user.id,
      prompt: input.prompt,
      negative_prompt: input.negativePrompt,
      params: {
        aspectRatio: aspectRatioLabel(preset.width, preset.height),
        width: preset.width,
        height: preset.height,
        count: input.count,
        sizePresetId: input.sizePresetId,
      },
      provider: getImageProvider().id,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !job) {
    console.error("[generateImages] insert", insertError);
    return err("DB_ERROR", "Không thể tạo tác vụ sinh ảnh.");
  }

  await supabase.from("generation_jobs").update({ status: "processing" }).eq("id", job.id);
  await trackEvent(
    { name: "generation_started", brandId: input.brandId, count: input.count },
    { userId: user.id, workspaceId: workspace.workspaceId }
  );

  try {
    const provider = getImageProvider();
    const images = await provider.generateImages({
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      width: preset.width,
      height: preset.height,
      count: input.count,
    });

    const output: GenerationOutputItem[] = [];
    for (const image of images) {
      const path = buildCreativeAssetPath(workspace.workspaceId, input.brandId, extensionForContentType(image.contentType));
      const { error: uploadError } = await uploadGeneratedImage(supabase, path, image.bytes, image.contentType);
      if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);
      output.push({ path, width: image.width, height: image.height, isDemo: image.isDemo });
    }

    await supabase.from("generation_jobs").update({ status: "succeeded", output }).eq("id", job.id);
    await trackEvent(
      { name: "generation_succeeded", jobId: job.id, count: output.length, provider: provider.id },
      { userId: user.id, workspaceId: workspace.workspaceId }
    );
  } catch (e) {
    // Sanitized — no stack trace, no provider internals, per PRD §13.
    console.error("[generateImages] provider", e);
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error: "Không thể tạo ảnh lúc này. Vui lòng thử lại." })
      .eq("id", job.id);
    await trackEvent(
      { name: "generation_failed", jobId: job.id, provider: getImageProvider().id },
      { userId: user.id, workspaceId: workspace.workspaceId }
    );
  }

  return ok({ jobId: job.id });
}

export async function saveGenerationResult(rawInput: unknown): Promise<ActionResult<{ assetId: string }>> {
  const parsed = saveResultSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  // Re-read the job server-side (RLS-scoped to the caller's own job) —
  // the asset's storage_path/width/height/prompt always come from THIS
  // row, never from client-supplied values, so a crafted request can't
  // claim an arbitrary Storage path as a new asset.
  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", input.jobId)
    .maybeSingle();

  if (jobError || !job) return err("NOT_FOUND", "Không tìm thấy tác vụ.");
  const item = job.output[input.outputIndex];
  if (!item) return err("NOT_FOUND", "Không tìm thấy kết quả này.");

  const { data: brand } = await supabase
    .from("brands")
    .select("current_guideline_version_id")
    .eq("id", job.brand_id)
    .maybeSingle();

  const { data: asset, error: insertError } = await supabase
    .from("creative_assets")
    .insert({
      workspace_id: job.workspace_id,
      brand_id: job.brand_id,
      owner_id: user.id,
      type: "image",
      name: input.name,
      campaign: input.campaign,
      status: "ready",
      storage_path: item.path,
      width: item.width,
      height: item.height,
      prompt: job.prompt,
      source_generation_job_id: job.id,
      guideline_version_id: brand?.current_guideline_version_id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !asset) {
    console.error("[saveGenerationResult]", insertError);
    return err("DB_ERROR", "Không thể lưu vào thư viện.");
  }

  revalidatePath("/create/image");
  revalidatePath("/library");
  return ok({ assetId: asset.id });
}

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Task 3.10 — an uploaded image as a generation ALTERNATIVE, not a
 * variant: it becomes a creative_asset directly, with no generation_jobs
 * row at all, since nothing was actually generated. */
export async function uploadImageAsset(
  brandId: string,
  file: File
): Promise<ActionResult<{ assetId: string }>> {
  if (!UPLOAD_ALLOWED_TYPES.includes(file.type)) {
    return err("VALIDATION_ERROR", "Định dạng không hỗ trợ. Dùng PNG, JPG hoặc WEBP.");
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return err("VALIDATION_ERROR", "File quá lớn. Tối đa 10MB.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const workspace = await getActiveWorkspace();
  if (!workspace) return err("FORBIDDEN", "Không tìm thấy workspace.");

  // Dimensions aren't known without decoding the image, which this
  // server has no image library for (by design — see the Demo Provider's
  // SVG-only approach). Stored as null; the Library/editor can read real
  // dimensions client-side from the file itself when needed.
  const path = buildCreativeAssetPath(workspace.workspaceId, brandId, extensionForContentType(file.type));
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await uploadGeneratedImage(supabase, path, bytes, file.type);
  if (uploadError) {
    console.error("[uploadImageAsset] upload", uploadError);
    return err("UPLOAD_ERROR", "Không thể tải lên. Bạn có quyền tạo tài sản trong workspace này không?");
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("current_guideline_version_id")
    .eq("id", brandId)
    .maybeSingle();

  const { data: asset, error: insertError } = await supabase
    .from("creative_assets")
    .insert({
      workspace_id: workspace.workspaceId,
      brand_id: brandId,
      owner_id: user.id,
      type: "image",
      name: file.name,
      status: "ready",
      storage_path: path,
      guideline_version_id: brand?.current_guideline_version_id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !asset) {
    console.error("[uploadImageAsset] insert", insertError);
    await supabase.storage.from("creative-assets").remove([path]);
    return err("DB_ERROR", "Không thể lưu tài sản.");
  }

  revalidatePath("/create/image");
  revalidatePath("/library");
  return ok({ assetId: asset.id });
}

/** Thin "use server" wrapper so the job-status poller (a Client
 * Component) can re-fetch without querying Supabase directly — same
 * pattern as getUnreadNotificationCountAction() in the Rymi project. */
export async function getGenerationJobAction(jobId: string): Promise<GenerationJob | null> {
  return getGenerationJob(jobId);
}
