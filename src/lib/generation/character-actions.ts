"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { getActiveWorkspace } from "@/lib/workspace/queries";
import { generateImages } from "./actions";
import { buildCharacterFacePath, extensionForContentType, resolveSignedAssetUrl, uploadGeneratedImage } from "./storage";
import {
  CHARACTER_VIEWS,
  CHARACTER_MIN_AGE,
  CHARACTER_MAX_AGE,
  type CharacterView,
  type CharacterGender,
  type CharacterEthnicity,
  type CharacterSheet,
} from "@/types/character";
import { getCharacterSheets } from "./character-queries";
import { resolveStylePromptText } from "./character-style";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const POSTGRES_UNIQUE_VIOLATION = "23505";
const MAX_APPEARANCE_LENGTH = 600;
const MAX_OUTFIT_LENGTH = 400;
const MAX_STYLE_LENGTH = 200;
const MAX_NEGATIVE_PROMPT_LENGTH = 500; // mirrors schema.ts's negativePrompt limit for the main Tạo ảnh flow
// Only Higgsfield Marketing Studio accepts more than one reference image
// in this app's adapters (see providers/marketing-studio-provider.ts,
// which reads `referenceImageUrls`; every other provider only reads the
// singular `referenceImageUrl` — see providers/higgsfield-provider.ts and
// gemini/openai's describeAdjustments). A chosen outfit reference image is
// only ever actually sent when this exact model is selected; otherwise
// it's silently dropped from the REQUEST (never from the UI's own
// disclosure — see character-builder.tsx's note next to the picker).
const MARKETING_STUDIO_MODEL_ID = "higgsfield-marketing-studio";
const STYLE_IDS = ["photo", "illustration", "cartoon", "cinematic", "editorial", "custom"] as const;
const GENDER_IDS = ["male", "female"] as const;
const ETHNICITY_IDS = ["vietnamese", "asian", "european"] as const;
const ageSchema = z.number().int().min(CHARACTER_MIN_AGE).max(CHARACTER_MAX_AGE);

const tagNameSchema = z
  .string()
  .trim()
  .min(2, "Tên định danh quá ngắn — cần ít nhất 2 ký tự.")
  .max(60, "Tên định danh quá dài — tối đa 60 ký tự.")
  .regex(/^[a-zA-Z0-9_.]+$/, "Tên định danh chỉ gồm chữ, số, dấu chấm và gạch dưới.");

const ETHNICITY_PHRASE: Record<CharacterEthnicity, string> = {
  vietnamese: "người Việt Nam",
  asian: "người châu Á",
  european: "người châu Âu",
};

function genderSubjectPhrase(gender: CharacterGender, ethnicity: CharacterEthnicity, age: number): string {
  const noun = gender === "male" ? "một nam người mẫu" : "một nữ người mẫu";
  return `${noun} ${ETHNICITY_PHRASE[ethnicity]}, khoảng ${age} tuổi`;
}

/**
 * Builds the turnaround-sheet prompt for one view angle. The pose set
 * itself (portrait/front/side/back) is fixed, product-defined — the point
 * of a "character sheet" is a consistent reference across angles, not an
 * arbitrary scene. Everything else (style phrase, appearance description,
 * active outfit description) is real, user-chosen input folded in
 * verbatim, never a cosmetic-only UI toggle with no effect on the actual
 * request sent to generateImages().
 */
function buildCharacterSheetPrompt(
  gender: CharacterGender,
  ethnicity: CharacterEthnicity,
  age: number,
  view: CharacterView,
  stylePhrase: string,
  appearanceDescription: string,
  outfitDescription: string
): string {
  const subject = genderSubjectPhrase(gender, ethnicity, age);
  const base = `Ảnh của ${subject}, khuôn mặt giống hệt ảnh tham chiếu đính kèm, kiểu tóc nhất quán xuyên suốt các góc chụp, nền phông trường quay màu xám nhạt trơn, ánh sáng studio đều, bố cục sạch.`;
  const viewSuffix: Record<CharacterView, string> = {
    portrait: "Góc chụp: chân dung cận mặt, từ vai trở lên, nhìn thẳng vào máy ảnh.",
    front: "Góc chụp: toàn thân, chính diện, nhìn thẳng vào máy ảnh.",
    side: "Góc chụp: toàn thân, nghiêng 3/4 bên trái.",
    back: "Góc chụp: toàn thân, từ phía sau.",
  };
  const appearance = appearanceDescription.trim();
  const outfit = outfitDescription.trim();
  return [
    base,
    stylePhrase ? `Phong cách: ${stylePhrase}.` : null,
    appearance ? `Ngoại hình: ${appearance}.` : null,
    outfit ? `Trang phục: ${outfit}.` : null,
    viewSuffix[view],
  ]
    .filter(Boolean)
    .join(" ");
}

function buildAiFacePrompt(
  gender: CharacterGender,
  ethnicity: CharacterEthnicity,
  age: number,
  stylePhrase: string,
  appearanceDescription: string
): string {
  const subject = genderSubjectPhrase(gender, ethnicity, age);
  const appearance = appearanceDescription.trim();
  return [
    `Ảnh chân dung cận mặt của ${subject}, nhìn thẳng vào máy ảnh, biểu cảm trung tính, nền trơn màu xám nhạt, ánh sáng studio chuyên nghiệp, chỉ một người duy nhất trong khung hình.`,
    stylePhrase ? `Phong cách: ${stylePhrase}.` : null,
    appearance ? `Ngoại hình: ${appearance}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Uploads a user's own face photo for the Character Builder — permanent
 * (unlike uploadReferenceImage's "_reference" folder), since a locked
 * character face is reused across every future sheet for that character,
 * not a one-request input. Same validation as every other upload in this
 * app (10MB, png/jpeg/webp only). */
export async function uploadCharacterFace(file: File): Promise<ActionResult<{ path: string; url: string }>> {
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

  const path = buildCharacterFacePath(workspace.workspaceId, extensionForContentType(file.type));
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await uploadGeneratedImage(supabase, path, bytes, file.type);
  if (uploadError) {
    console.error("[uploadCharacterFace] upload", uploadError);
    return err("UPLOAD_ERROR", "Không thể tải lên ảnh khuôn mặt. Kiểm tra kết nối mạng rồi thử lại.");
  }

  const url = await resolveSignedAssetUrl(supabase, path);
  if (!url) return err("UPLOAD_ERROR", "Không thể tạo đường dẫn cho ảnh khuôn mặt.");

  return ok({ path, url });
}

const generateCharacterFaceSchema = z.object({
  brandId: z.string().uuid(),
  gender: z.enum(GENDER_IDS),
  ethnicity: z.enum(ETHNICITY_IDS).default("vietnamese"),
  age: ageSchema.default(22),
  style: z.enum(STYLE_IDS).default("photo"),
  customStyle: z.string().trim().max(MAX_STYLE_LENGTH, "Mô tả phong cách quá dài.").default(""),
  appearanceDescription: z.string().trim().max(MAX_APPEARANCE_LENGTH, "Mô tả ngoại hình quá dài.").default(""),
  model: z.string().trim().min(1).default("auto"),
  sizePresetId: z.string().uuid(),
});

/** "AI tự tạo" face path — generates ONE portrait through the exact same
 * generateImages() pipeline every other image in this app goes through
 * (same provider fallback chain, same attempts/adjustments transparency,
 * same Demo-provider honesty when nothing real is configured). Returns a
 * jobId the client polls with the existing getGenerationJobAction; the
 * user reviews the result before createCharacter() locks it in — never
 * auto-confirmed. */
export async function generateCharacterFace(rawInput: unknown): Promise<ActionResult<{ jobId: string }>> {
  const parsed = generateCharacterFaceSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  return generateImages({
    brandId: input.brandId,
    prompt: buildAiFacePrompt(
      input.gender,
      input.ethnicity,
      input.age,
      resolveStylePromptText(input.style, input.customStyle),
      input.appearanceDescription
    ),
    negativePrompt: "",
    sizePresetId: input.sizePresetId,
    count: 1,
    model: input.model,
  });
}

const createCharacterSchema = z
  .object({
    displayName: z.string().trim().max(100, "Tên nhân vật quá dài — tối đa 100 ký tự.").default(""),
    tagName: tagNameSchema,
    gender: z.enum(GENDER_IDS),
    ethnicity: z.enum(ETHNICITY_IDS).default("vietnamese"),
    age: ageSchema.default(22),
    faceSource: z.enum(["upload", "ai"]),
    consentConfirmed: z.boolean().default(false),
    faceStoragePath: z.string().trim().min(1).optional(),
    faceJobId: z.string().uuid().optional(),
    faceOutputIndex: z.number().int().min(0).optional(),
  })
  .refine((data) => data.faceSource !== "upload" || (data.consentConfirmed && Boolean(data.faceStoragePath)), {
    message: "Cần xác nhận quyền sử dụng ảnh và tải lên ảnh khuôn mặt.",
    path: ["consentConfirmed"],
  })
  .refine((data) => data.faceSource !== "ai" || (Boolean(data.faceJobId) && data.faceOutputIndex !== undefined), {
    message: "Cần chọn một ảnh khuôn mặt do AI tạo trước khi tạo nhân vật.",
    path: ["faceJobId"],
  });

/** Creates the character row and locks its face — for `faceSource:
 * "upload"`, `faceStoragePath` comes from uploadCharacterFace() above
 * (already this user's own object, under their workspace's folder,
 * checked below). For `faceSource: "ai"`, the storage path is NEVER
 * trusted from the client: it's re-read from the caller's OWN
 * generation_jobs row (RLS "own generation jobs" — same re-read pattern
 * as saveGenerationResult in actions.ts), so a crafted request can't
 * claim an arbitrary Storage path as a character's face.
 *
 * Tag uniqueness is checked twice: a fast pre-check here (friendly error
 * before anything is written) AND the database's own unique index
 * (migration 0008, case-insensitive per workspace) as the real guard
 * against a race between two concurrent requests — a 23505 from the
 * insert is caught below and turned into the same friendly message. */
export async function createCharacter(rawInput: unknown): Promise<ActionResult<{ characterId: string }>> {
  const parsed = createCharacterSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const workspace = await getActiveWorkspace();
  if (!workspace) return err("FORBIDDEN", "Không tìm thấy workspace.");

  const { data: existing } = await supabase
    .from("characters")
    .select("id")
    .eq("workspace_id", workspace.workspaceId)
    .ilike("tag_name", input.tagName)
    .maybeSingle();
  if (existing) return err("VALIDATION_ERROR", `Tag "@${input.tagName}" đã được dùng cho một nhân vật khác trong workspace này.`);

  let faceStoragePath: string;
  if (input.faceSource === "upload") {
    if (!input.faceStoragePath!.startsWith(`${workspace.workspaceId}/_character-faces/`)) {
      return err("VALIDATION_ERROR", "Ảnh khuôn mặt không hợp lệ.");
    }
    faceStoragePath = input.faceStoragePath!;
  } else {
    const { data: job, error: jobError } = await supabase
      .from("generation_jobs")
      .select("output")
      .eq("id", input.faceJobId!)
      .maybeSingle();
    if (jobError || !job) return err("NOT_FOUND", "Không tìm thấy ảnh khuôn mặt đã tạo.");
    const item = job.output[input.faceOutputIndex!];
    if (!item) return err("NOT_FOUND", "Không tìm thấy ảnh khuôn mặt này.");
    faceStoragePath = item.path;
  }

  const { data: character, error: insertError } = await supabase
    .from("characters")
    .insert({
      workspace_id: workspace.workspaceId,
      created_by: user.id,
      display_name: input.displayName,
      tag_name: input.tagName,
      gender: input.gender,
      ethnicity: input.ethnicity,
      age: input.age,
      face_source: input.faceSource,
      face_storage_path: faceStoragePath,
      face_locked: true,
      consent_confirmed: input.faceSource === "upload" ? input.consentConfirmed : false,
    })
    .select("id")
    .single();

  if (insertError || !character) {
    if (insertError?.code === POSTGRES_UNIQUE_VIOLATION) {
      return err("VALIDATION_ERROR", `Tag "@${input.tagName}" đã được dùng cho một nhân vật khác trong workspace này.`);
    }
    console.error("[createCharacter]", insertError);
    return err(
      "DB_ERROR",
      insertError?.code === "42P01"
        ? "Chưa thể tạo nhân vật — bảng dữ liệu `characters` chưa tồn tại. Cần chạy migration 0008_characters.sql trên Supabase trước."
        : "Không thể tạo nhân vật. Vui lòng thử lại."
    );
  }

  revalidatePath("/create/character");
  return ok({ characterId: character.id });
}

const renameCharacterSchema = z.object({
  characterId: z.string().uuid(),
  displayName: z.string().trim().max(100, "Tên nhân vật quá dài — tối đa 100 ký tự.").default(""),
  tagName: tagNameSchema,
});

/** Renames a character — tag_name/display_name only. Deliberately cannot
 * touch the locked face (face_storage_path/face_source/consent) or
 * gender/ethnicity/age: those define the identity a sheet's face
 * reference keeps consistent, so changing them here would silently
 * invalidate every past sheet's "same character" claim. RLS ("owner or
 * admin manages
 * characters") independently re-checks the caller owns this character or
 * admins the workspace. */
export async function renameCharacter(rawInput: unknown): Promise<ActionResult<null>> {
  const parsed = renameCharacterSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("workspace_id")
    .eq("id", input.characterId)
    .maybeSingle();
  if (characterError || !character) return err("NOT_FOUND", "Không tìm thấy nhân vật này.");

  const { data: existing } = await supabase
    .from("characters")
    .select("id")
    .eq("workspace_id", character.workspace_id)
    .ilike("tag_name", input.tagName)
    .neq("id", input.characterId)
    .maybeSingle();
  if (existing) return err("VALIDATION_ERROR", `Tag "@${input.tagName}" đã được dùng cho một nhân vật khác trong workspace này.`);

  const { error: updateError, count } = await supabase
    .from("characters")
    .update({ display_name: input.displayName, tag_name: input.tagName }, { count: "exact" })
    .eq("id", input.characterId);

  if (updateError) {
    if (updateError.code === POSTGRES_UNIQUE_VIOLATION) {
      return err("VALIDATION_ERROR", `Tag "@${input.tagName}" đã được dùng cho một nhân vật khác trong workspace này.`);
    }
    console.error("[renameCharacter]", updateError);
    return err("DB_ERROR", "Không thể đổi tên nhân vật.");
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền đổi tên nhân vật này.");

  revalidatePath("/create/character");
  return ok(null);
}

const createCharacterSheetSchema = z.object({
  characterId: z.string().uuid(),
  brandId: z.string().uuid(),
  model: z.string().trim().min(1).default("auto"),
  sizePresetId: z.string().uuid(),
  count: z.number().int().min(1).max(4).default(2),
  style: z.enum(STYLE_IDS).default("photo"),
  customStyle: z.string().trim().max(MAX_STYLE_LENGTH, "Mô tả phong cách quá dài.").default(""),
  appearanceDescription: z.string().trim().max(MAX_APPEARANCE_LENGTH, "Mô tả ngoại hình quá dài.").default(""),
  outfitDescription: z.string().trim().max(MAX_OUTFIT_LENGTH, "Mô tả trang phục quá dài.").default(""),
  // A signed URL to an outfit reference image already uploaded to our own
  // Storage via uploadReferenceImage() — same SSRF constraint as every
  // other reference-image field, re-checked by generateImages() itself.
  outfitReferenceImageUrl: z.string().url().optional(),
  negativePrompt: z.string().trim().max(MAX_NEGATIVE_PROMPT_LENGTH, "Phần loại trừ quá dài.").default(""),
});

export interface CharacterSheetViewResult {
  view: CharacterView;
  ok: boolean;
  jobId: string | null;
  error: string | null;
}

/**
 * Generates a character sheet: `count` views (CHARACTER_VIEWS, in order —
 * portrait, front, side, back), each through the UNMODIFIED
 * generateImages() pipeline with the character's locked face as
 * referenceImageUrl. Every view is its own real generation_jobs row with
 * its own fallback chain and attempts — this function only adds the
 * character_id/character_view/character_sheet_id linkage as a follow-up
 * UPDATE once each job exists, never branches the core generation logic
 * itself. A view whose model doesn't actually support reference images
 * (see each adapter's describeAdjustments) still generates — just without
 * face consistency, which the existing attempts.adjustments mechanism
 * already surfaces transparently, same as every other model limitation in
 * this app.
 */
export async function createCharacterSheet(
  rawInput: unknown
): Promise<ActionResult<{ sheetId: string; results: CharacterSheetViewResult[]; outfitImageSent: boolean }>> {
  const parsed = createCharacterSheetSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("*")
    .eq("id", input.characterId)
    .maybeSingle();
  if (characterError || !character) return err("NOT_FOUND", "Không tìm thấy nhân vật này.");

  const faceUrl = await resolveSignedAssetUrl(supabase, character.face_storage_path);
  if (!faceUrl) return err("NOT_FOUND", "Không thể lấy ảnh khuôn mặt đã khóa của nhân vật này.");

  // Only Marketing Studio's adapter reads `referenceImageUrls` (plural) —
  // every other model only reads the singular `referenceImageUrl`, so an
  // outfit reference image is only ever actually transmitted here; for
  // any other model it's silently excluded from the REQUEST (never
  // claimed as applied — character-builder.tsx shows the same condition
  // next to the picker before the user even submits).
  const outfitImageSent = Boolean(input.outfitReferenceImageUrl) && input.model === MARKETING_STUDIO_MODEL_ID;
  const referenceFields = outfitImageSent
    ? { referenceImageUrls: [faceUrl, input.outfitReferenceImageUrl!] }
    : { referenceImageUrl: faceUrl };

  const stylePhrase = resolveStylePromptText(input.style, input.customStyle);
  const sheetId = crypto.randomUUID();
  const views = CHARACTER_VIEWS.slice(0, input.count);
  const results: CharacterSheetViewResult[] = [];

  for (const view of views) {
    const result = await generateImages({
      brandId: input.brandId,
      prompt: buildCharacterSheetPrompt(
        character.gender,
        character.ethnicity,
        character.age,
        view,
        stylePhrase,
        input.appearanceDescription,
        input.outfitDescription
      ),
      negativePrompt: input.negativePrompt,
      sizePresetId: input.sizePresetId,
      count: 1,
      model: input.model,
      ...referenceFields,
    });

    if (!result.ok) {
      results.push({ view, ok: false, jobId: null, error: result.error.message });
      continue;
    }

    const { error: updateError } = await supabase
      .from("generation_jobs")
      .update({ character_id: input.characterId, character_view: view, character_sheet_id: sheetId })
      .eq("id", result.data.jobId);
    if (updateError) console.error("[createCharacterSheet] link job", updateError);

    results.push({ view, ok: true, jobId: result.data.jobId, error: null });
  }

  if (results.every((r) => !r.ok)) {
    return err("PROVIDER_ERROR", results[0]?.error ?? GENERIC_ERROR);
  }

  revalidatePath("/create/character");
  return ok({ sheetId, results, outfitImageSent });
}

/** Thin "use server" wrapper so the character panel (a Client Component)
 * can re-fetch a character's sheet history after generating a new one,
 * without querying Supabase directly — same pattern as
 * getGenerationJobAction in actions.ts. Returns an ActionResult (unlike
 * getCharacterSheets itself, which throws) so the UI can tell "query
 * failed" apart from "no sheets yet" — see character-builder.tsx's
 * distinct loading/error/empty states. */
export async function getCharacterSheetsAction(characterId: string): Promise<ActionResult<CharacterSheet[]>> {
  try {
    const sheets = await getCharacterSheets(characterId);
    return ok(sheets);
  } catch (e) {
    console.error("[getCharacterSheetsAction]", e);
    return err("DB_ERROR", "Không thể tải lịch sử bảng nhân vật.");
  }
}

const deleteCharacterSheetSchema = z.object({
  characterSheetId: z.string().uuid(),
});

/** Deletes every result of one "Tạo bảng nhân vật" click — the
 * generation_jobs rows sharing this character_sheet_id, PLUS any
 * creative_assets rows saved from them (same storage-cleanup pattern as
 * deleteAsset in lib/library/actions.ts, so a deleted sheet never leaves
 * orphaned files in Storage). RLS re-checks ownership/admin on every
 * table touched — this function is the entry point, not the boundary. */
export async function deleteCharacterSheet(rawInput: unknown): Promise<ActionResult<null>> {
  const parsed = deleteCharacterSheetSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Bạn cần đăng nhập");

  const { data: jobs, error: jobsError } = await supabase
    .from("generation_jobs")
    .select("id")
    .eq("character_sheet_id", input.characterSheetId);
  if (jobsError) {
    console.error("[deleteCharacterSheet] read jobs", jobsError);
    return err("DB_ERROR", "Không thể xoá bảng nhân vật này.");
  }
  const jobIds = (jobs ?? []).map((j) => j.id);
  if (jobIds.length === 0) return err("NOT_FOUND", "Không tìm thấy bảng nhân vật này.");

  const { data: assets } = await supabase
    .from("creative_assets")
    .select("id, storage_path")
    .in("source_generation_job_id", jobIds);

  if (assets && assets.length > 0) {
    const { error: deleteAssetsError } = await supabase
      .from("creative_assets")
      .delete()
      .in(
        "id",
        assets.map((a) => a.id)
      );
    if (deleteAssetsError) console.error("[deleteCharacterSheet] delete assets", deleteAssetsError);
    const paths = assets.map((a) => a.storage_path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) await supabase.storage.from("creative-assets").remove(paths);
  }

  const { error: deleteJobsError, count } = await supabase
    .from("generation_jobs")
    .delete({ count: "exact" })
    .eq("character_sheet_id", input.characterSheetId);
  if (deleteJobsError) {
    console.error("[deleteCharacterSheet] delete jobs", deleteJobsError);
    return err("DB_ERROR", "Không thể xoá bảng nhân vật này.");
  }
  if (!count) return err("FORBIDDEN", "Bạn không có quyền xoá bảng nhân vật này.");

  revalidatePath("/create/character");
  revalidatePath("/library");
  return ok(null);
}
