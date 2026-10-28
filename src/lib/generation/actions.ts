"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { generateImageInputSchema, saveResultSchema } from "./schema";
import { getModel, resolveModelChain } from "./providers";
import { ProviderError } from "./providers/types";
import { fetchMarketingStudioPresets, type MarketingStudioPreset } from "./providers/marketing-studio-provider";
import { readImageDimensions } from "./image-dimensions";
import {
  buildCreativeAssetPath,
  buildReferenceImagePath,
  uploadGeneratedImage,
  resolveSignedAssetUrl,
  extensionForContentType,
} from "./storage";
import { getActiveWorkspace } from "@/lib/workspace/queries";
import { getGenerationJob } from "./queries";
import { trackEvent } from "@/lib/analytics/track";
import type { GenerationAttempt, GenerationOutputItem } from "@/types/database";
import type { GenerationJob } from "@/types/generation";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

// Category-specific wording for the retryable errors the fallback chain
// gave up on, so the UI never falls back to one generic sentence for
// causes as different as "no network to the provider" and "rate limited" —
// each still ends with the actual provider message for a debuggable detail.
function buildExhaustedChainMessage(chainLength: number, lastError: ProviderError | null): string {
  const suffix = chainLength > 1 ? " (đã thử tất cả model dự phòng)." : ".";
  if (!lastError) {
    return chainLength > 1
      ? "Tất cả model đã thử đều không thành công. Vui lòng thử lại."
      : "Không thể tạo ảnh lúc này. Vui lòng thử lại.";
  }
  const prefixByCode: Record<string, string> = {
    unavailable: "Không thể kết nối tới model tạo ảnh",
    timeout: "Model tạo ảnh phản hồi quá lâu (hết thời gian chờ)",
    rate_limited: "Model tạo ảnh đang bị giới hạn tốc độ",
    quota_exceeded: "Đã hết hạn mức sử dụng cho model này",
  };
  const prefix = prefixByCode[lastError.code] ?? "Không thể tạo ảnh lúc này";
  return `${prefix}${suffix} ${lastError.message}`.trim();
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function aspectRatioLabel(width: number, height: number): string {
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}

// Marketing Studio's own API never takes pixel width/height — it takes an
// aspect_ratio string + a resolution tier (see marketing-studio-provider.ts).
// generation_jobs.params still stores width/height for every job (the
// idempotency check and the UI's existing "W×H" displays rely on it), so
// this derives an APPROXIMATE bookkeeping size from the tier, confirmed
// live only for "1k"+"1:1" (-> real 1024x1024 output). It is never sent to
// the provider and never trusted as the real output size — the actual
// saved asset's width/height always comes from reading the downloaded
// image's own bytes (see image-dimensions.ts), same as every other model.
const RESOLUTION_LONG_EDGE_PX: Record<string, number> = { "1k": 1024, "2k": 2048, "4k": 4096 };
function approximateDimensionsForAspectRatio(aspectRatio: string, resolution: string): { width: number; height: number } {
  const longEdge = RESOLUTION_LONG_EDGE_PX[resolution] ?? RESOLUTION_LONG_EDGE_PX["1k"];
  const [wRatio, hRatio] = aspectRatio === "auto" ? [1, 1] : aspectRatio.split(":").map(Number);
  if (!wRatio || !hRatio) return { width: longEdge, height: longEdge };
  return wRatio >= hRatio
    ? { width: longEdge, height: Math.round((longEdge * hRatio) / wRatio) }
    : { width: Math.round((longEdge * wRatio) / hRatio), height: longEdge };
}

const IDEMPOTENCY_WINDOW_MS = 15_000;

/**
 * Creates a job row and processes it SYNCHRONOUSLY within this same
 * Server Action (see migration 0004's comment on generation_jobs — there
 * is no separate background worker in Phase 1). Still writes through the
 * full queued -> processing -> succeeded/failed lifecycle so the UI and
 * schema are already correct for a slower real provider — which, as of
 * the model-fallback feature, is now actually wired in (Gemini/Higgsfield/
 * OpenAI), not just scaffolded.
 *
 * Tries the user's chosen model first, then falls back through the
 * configured chain (resolveModelChain) on retryable provider errors only
 * — never on invalid input or a content-policy refusal, per product spec.
 * Every attempt is appended to generation_jobs.attempts as it happens, so
 * JobStatus's poller can show live "Đang thử X… / đang chuyển sang Y…"
 * progress without any new transport.
 */
export async function generateImages(rawInput: unknown): Promise<ActionResult<{ jobId: string }>> {
  const parsed = generateImageInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  // Per-model prompt length — the schema above only enforces the highest
  // confirmed ceiling across all models (32000, OpenAI); the model that
  // will actually be tried first may support much less (e.g. 1000 for
  // Gemini/Higgsfield/Demo). Checked before any DB write so an over-limit
  // prompt never creates a job row at all.
  const chain = (() => {
    const resolved = resolveModelChain(input.model);
    return resolved.length > 0 ? resolved : ["demo"]; // only reached when zero real models are configured at all
  })();
  const firstModel = getModel(chain[0]);
  if (input.prompt.length > firstModel.capabilities.maxPromptLength) {
    return err(
      "VALIDATION_ERROR",
      `Mô tả vượt quá giới hạn của model ${firstModel.label} (tối đa ${firstModel.capabilities.maxPromptLength.toLocaleString("vi-VN")} ký tự). Rút ngắn mô tả hoặc đổi sang model khác.`
    );
  }

  // referenceImageUrl must point at OUR OWN Storage (the only thing
  // uploadReferenceImage ever returns) — reject anything else before it
  // ever reaches a provider adapter, which would otherwise hand an
  // attacker-chosen URL to a third-party API to fetch on our behalf (SSRF).
  if (input.referenceImageUrl) {
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    if (new URL(input.referenceImageUrl).origin !== supabaseOrigin) {
      return err("VALIDATION_ERROR", "Ảnh tham chiếu không hợp lệ.");
    }
  }
  if (input.referenceImageUrls?.length) {
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    if (input.referenceImageUrls.some((u) => new URL(u).origin !== supabaseOrigin)) {
      return err("VALIDATION_ERROR", "Ảnh tham chiếu không hợp lệ.");
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const workspace = await getActiveWorkspace();
  if (!workspace) return err("FORBIDDEN", "Không tìm thấy workspace.");

  // Size source: either a workspace size_presets row (the normal path for
  // every model), or an `exactSize` the client already resolved to one of
  // a specific model's own native values (e.g. HiggsfieldSizePicker) —
  // the schema's refine() guarantees exactly one of these is present, so
  // no silent re-derivation of one from the other happens here.
  let width: number;
  let height: number;
  if (input.exactSize) {
    width = input.exactSize.width;
    height = input.exactSize.height;
  } else if (input.aspectRatio) {
    ({ width, height } = approximateDimensionsForAspectRatio(input.aspectRatio, input.resolution ?? "1k"));
  } else {
    if (!input.sizePresetId) return err("VALIDATION_ERROR", "Cần chọn kích thước.");
    const { data: preset, error: presetError } = await supabase
      .from("size_presets")
      .select("width, height")
      .eq("id", input.sizePresetId)
      .maybeSingle();

    if (presetError || !preset) {
      return err("VALIDATION_ERROR", "Preset kích thước không hợp lệ.");
    }
    width = preset.width;
    height = preset.height;
  }

  // Idempotency guard — a double-click or a client-side retry of the same
  // request within a short window reuses the in-flight job instead of
  // creating a duplicate one (PRD ask: "chống tạo job trùng").
  const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString();
  const { data: recentJobs } = await supabase
    .from("generation_jobs")
    .select("id, prompt, negative_prompt, params")
    .eq("user_id", user.id)
    .eq("brand_id", input.brandId)
    .in("status", ["queued", "processing"])
    .gte("created_at", since);
  const duplicate = (recentJobs ?? []).find(
    (j) =>
      j.prompt === input.prompt &&
      j.negative_prompt === input.negativePrompt &&
      j.params.width === width &&
      j.params.height === height &&
      j.params.count === input.count &&
      (j.params.resolution ?? null) === (input.resolution ?? null) &&
      (j.params.presetId ?? null) === (input.presetId ?? null)
  );
  if (duplicate) return ok({ jobId: duplicate.id });

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
        aspectRatio: input.aspectRatio ?? aspectRatioLabel(width, height),
        width,
        height,
        count: input.count,
        sizePresetId: input.sizePresetId ?? null,
        resolution: input.resolution ?? null,
        presetId: input.presetId ?? null,
        enhancePrompt: input.enhancePrompt,
      },
      requested_model: input.model,
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

  const genParams = {
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    width,
    height,
    count: input.count,
    referenceImageUrl: input.referenceImageUrl,
    referenceImageUrls: input.referenceImageUrls,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    enhancePrompt: input.enhancePrompt,
    presetId: input.presetId,
  };

  const attempts: GenerationAttempt[] = [];
  let succeeded = false;
  let fatalErrorMessage: string | null = null;
  let lastRetryableError: ProviderError | null = null;

  for (const modelId of chain) {
    const model = getModel(modelId);
    const attempt: GenerationAttempt = {
      model: modelId,
      status: "started",
      startedAt: new Date().toISOString(),
      adjustments: model.describeAdjustments(genParams),
    };
    attempts.push(attempt);
    await supabase.from("generation_jobs").update({ attempts }).eq("id", job.id);

    try {
      const images = await model.generateImages(genParams);

      const output: GenerationOutputItem[] = [];
      for (const image of images) {
        const path = buildCreativeAssetPath(workspace.workspaceId, input.brandId, extensionForContentType(image.contentType));
        const { error: uploadError } = await uploadGeneratedImage(supabase, path, image.bytes, image.contentType);
        if (uploadError) throw new ProviderError("unavailable", `Lỗi lưu trữ: ${uploadError.message}`);
        output.push({ path, width: image.width, height: image.height, isDemo: image.isDemo });
      }

      attempt.status = "succeeded";
      attempt.finishedAt = new Date().toISOString();
      await supabase
        .from("generation_jobs")
        .update({ status: "succeeded", output, provider: modelId, model: modelId, final_model: modelId, attempts })
        .eq("id", job.id);
      await trackEvent(
        { name: "generation_succeeded", jobId: job.id, count: output.length, provider: modelId },
        { userId: user.id, workspaceId: workspace.workspaceId }
      );
      succeeded = true;
      break;
    } catch (e) {
      const providerError = e instanceof ProviderError ? e : new ProviderError("unavailable", GENERIC_ERROR);
      // Sanitized — no stack trace, no provider internals in what's ever
      // shown to the user; the real error stays server-side in logs only.
      console.error("[generateImages] attempt failed", { jobId: job.id, model: modelId, code: providerError.code, e });

      attempt.status = "failed";
      attempt.errorCode = providerError.code;
      attempt.finishedAt = new Date().toISOString();
      await supabase.from("generation_jobs").update({ attempts }).eq("id", job.id);
      await trackEvent(
        { name: "generation_attempt_failed", jobId: job.id, model: modelId, errorCode: providerError.code },
        { userId: user.id, workspaceId: workspace.workspaceId }
      );

      if (!providerError.retryable) {
        // Invalid input or content-policy refusal — stop immediately,
        // never try another model for the same bad/blocked request.
        fatalErrorMessage = providerError.message;
        break;
      }
      // Retryable (unavailable/timeout/rate_limited/quota_exceeded) —
      // fall through to the next model in the chain, if any.
      lastRetryableError = providerError;
    }
  }

  if (!succeeded) {
    const message = fatalErrorMessage ?? buildExhaustedChainMessage(chain.length, lastRetryableError);
    await supabase.from("generation_jobs").update({ status: "failed", error: message, attempts }).eq("id", job.id);
    await trackEvent(
      { name: "generation_failed", jobId: job.id, provider: attempts.at(-1)?.model ?? "unknown" },
      { userId: user.id, workspaceId: workspace.workspaceId }
    );
  }

  return ok({ jobId: job.id });
}

export async function saveGenerationResult(
  rawInput: unknown
): Promise<ActionResult<{ assetId: string; path: string; width: number; height: number }>> {
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
  return ok({ assetId: asset.id, path: item.path, width: item.width, height: item.height });
}

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Task 3.10 — an uploaded image as a generation ALTERNATIVE, not a
 * variant: it becomes a creative_asset directly, with no generation_jobs
 * row at all, since nothing was actually generated. Also reused by the
 * editor's AI-image-on-background feature to save a CLIENT-processed
 * (background-removed + feathered) PNG, since that final file is produced
 * in the browser via Canvas, not by a provider adapter — `options` lets
 * that caller attach the originating prompt/job for traceability without
 * this function needing to know anything about AI generation itself. */
export async function uploadImageAsset(
  brandId: string,
  file: File,
  options?: { prompt?: string; sourceGenerationJobId?: string }
): Promise<ActionResult<{ assetId: string; path: string; width: number | null; height: number | null }>> {
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

  const path = buildCreativeAssetPath(workspace.workspaceId, brandId, extensionForContentType(file.type));
  const bytes = Buffer.from(await file.arrayBuffer());
  // Read real dimensions from the bytes (PNG/JPEG/WebP header or SVG
  // width/height/viewBox — see image-dimensions.ts) rather than trusting
  // anything the client might claim; null only when the format genuinely
  // isn't recognized.
  const dimensions = readImageDimensions(bytes);
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
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      prompt: options?.prompt ?? null,
      source_generation_job_id: options?.sourceGenerationJobId ?? null,
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
  return ok({ assetId: asset.id, path, width: dimensions?.width ?? null, height: dimensions?.height ?? null });
}

/** Uploads a reference image for the Reference/@ Elements composer
 * controls — Storage only, deliberately NO creative_assets row (an input
 * to generation isn't a library deliverable, so it never clutters Thư
 * viện). Returns a short-lived signed URL, same 1h TTL convention as
 * every other signed URL in this app; the caller must re-request if the
 * composer sits open long enough for it to expire. */
export async function uploadReferenceImage(file: File): Promise<ActionResult<{ url: string }>> {
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

  const path = buildReferenceImagePath(workspace.workspaceId, extensionForContentType(file.type));
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await uploadGeneratedImage(supabase, path, bytes, file.type);
  if (uploadError) {
    console.error("[uploadReferenceImage] upload", uploadError);
    return err("UPLOAD_ERROR", "Không thể tải lên ảnh tham chiếu.");
  }

  const url = await resolveSignedAssetUrl(supabase, path);
  if (!url) return err("UPLOAD_ERROR", "Không thể tạo đường dẫn cho ảnh tham chiếu.");

  return ok({ url });
}

/** Resolves an EXISTING library image asset to a fresh signed URL, for
 * the "@ Elements" picker — lets the user reuse one of their own past
 * images as a reference without re-uploading it. Only ever resolves
 * assets the caller can already see (RLS-scoped select), never an
 * arbitrary path. */
export async function resolveAssetAsReference(assetId: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: asset, error } = await supabase
    .from("creative_assets")
    .select("storage_path")
    .eq("id", assetId)
    .maybeSingle();
  if (error || !asset?.storage_path) return err("NOT_FOUND", "Không tìm thấy tài sản này.");

  const url = await resolveSignedAssetUrl(supabase, asset.storage_path);
  if (!url) return err("UPLOAD_ERROR", "Không thể tạo đường dẫn cho tài sản này.");

  return ok({ url });
}

/** Thin "use server" wrapper so the job-status poller (a Client
 * Component) can re-fetch without querying Supabase directly — same
 * pattern as getUnreadNotificationCountAction() in the Rymi project. */
export async function getGenerationJobAction(jobId: string): Promise<GenerationJob | null> {
  return getGenerationJob(jobId);
}

/**
 * Live Marketing Studio enhancement presets — fetched from Higgsfield's
 * own presets endpoint on every call (no local cache), never hardcoded:
 * the docs explicitly warn preset visibility changes over time, so a
 * stale local copy could offer a preset_id the API no longer accepts.
 * Requires login only (no brandId) since presets aren't workspace-scoped.
 */
export async function getMarketingStudioPresets(
  cursor?: number
): Promise<ActionResult<{ items: MarketingStudioPreset[]; nextCursor: number | null; total: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  try {
    const result = await fetchMarketingStudioPresets(cursor);
    return ok(result);
  } catch (e) {
    const providerError = e instanceof ProviderError ? e : new ProviderError("unavailable", GENERIC_ERROR);
    console.error("[getMarketingStudioPresets]", { code: providerError.code, e });
    return err("PROVIDER_ERROR", providerError.message);
  }
}
