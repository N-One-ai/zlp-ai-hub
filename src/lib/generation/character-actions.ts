"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { getActiveWorkspace } from "@/lib/workspace/queries";
import { generateImages } from "./actions";
import { buildCharacterFacePath, extensionForContentType, resolveSignedAssetUrl, uploadGeneratedImage } from "./storage";
import { getModel, resolveModelChain } from "./providers";
import {
  CHARACTER_MIN_AGE,
  CHARACTER_MAX_AGE,
  type CharacterView,
  type CharacterGender,
  type CharacterEthnicity,
  type CharacterSheet,
} from "@/types/character";
import { getCharacterSheets } from "./character-queries";
import { resolveStylePromptText } from "./character-style";
import { MARKETING_STUDIO_ASPECT_RATIOS, MARKETING_STUDIO_RESOLUTIONS } from "./schema";

const GENERIC_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_TABLE_MISSING = "42P01";
// PostgREST's own "schema cache" error family — distinct from a real
// Postgres error code. PGRST205 = the table itself isn't in the cache
// (table truly missing, or the cache is stale right after a migration
// just ran); PGRST204 = the table IS in the cache but a specific column
// isn't — confirmed live in this exact app: `characters` existed (an
// earlier, partial run of migration 0008_characters.sql before every
// ADD COLUMN made it in — see that file's own "belt-and-suspenders"
// comment) but was missing `age`, and every character creation failed
// with "Không thể tạo nhân vật. Vui lòng thử lại." and no indication why.
// Both mean the live `characters` table doesn't match this file's own
// schema — the fix is the SAME re-run of 0008 either way, now self-
// healing regardless of which column(s) are missing.
function describeCharactersTableError(insertError: { code?: string | null; message?: string | null } | null): string {
  if (insertError?.code === POSTGRES_TABLE_MISSING || insertError?.code === "PGRST205") {
    return "Chưa thể tạo nhân vật — bảng dữ liệu `characters` chưa tồn tại. Cần chạy migration 0008_characters.sql trên Supabase trước.";
  }
  if (insertError?.code === "PGRST204") {
    return `Chưa thể tạo nhân vật — cấu trúc bảng \`characters\` trên Supabase thiếu cột dữ liệu (${insertError.message ?? "không rõ cột nào"}). Cần chạy lại migration 0008_characters.sql (đã cập nhật để tự bổ sung cột còn thiếu) trên Supabase SQL Editor.`;
  }
  return "Không thể tạo nhân vật. Vui lòng thử lại.";
}
const MAX_APPEARANCE_LENGTH = 600;
const MAX_OUTFIT_LENGTH = 400;
const MAX_STYLE_LENGTH = 200;
const MAX_NEGATIVE_PROMPT_LENGTH = 500; // mirrors schema.ts's negativePrompt limit for the main Tạo ảnh flow
const STYLE_IDS = ["photo", "illustration", "cartoon", "cinematic", "editorial", "custom"] as const;
const GENDER_IDS = ["male", "female"] as const;
const ETHNICITY_IDS = ["vietnamese", "asian", "european"] as const;
const ageSchema = z.number().int().min(CHARACTER_MIN_AGE).max(CHARACTER_MAX_AGE);

// The same 3 mutually-exclusive size sources generateImageInputSchema
// (schema.ts) accepts for the main Tạo ảnh flow — "Size ảnh" in Character
// Builder needs the same flexibility (a chosen aspect ratio may not have
// a matching workspace preset), not a 4th, Character-Builder-only size
// concept. `sizePresetId` wins when a real preset of that ratio exists
// (exact, authoritative dimensions); otherwise `exactSize` (most models —
// each adapter further snaps to its own real supported size, e.g.
// Higgsfield/OpenAI, so an approximate pixel value here is never sent
// as-is to a model that can't actually produce it) or `aspectRatio`+
// `resolution` (Marketing Studio only — its real API has no width/height
// param at all, see providers/marketing-studio-provider.ts).
const sizeFieldsSchema = z.object({
  sizePresetId: z.string().uuid().optional(),
  exactSize: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
  aspectRatio: z.enum(MARKETING_STUDIO_ASPECT_RATIOS).optional(),
  resolution: z.enum(MARKETING_STUDIO_RESOLUTIONS).optional(),
});
type SizeFields = z.infer<typeof sizeFieldsSchema>;
function hasExactlyOneSizeSource(data: SizeFields): boolean {
  return [Boolean(data.sizePresetId), Boolean(data.exactSize), Boolean(data.aspectRatio)].filter(Boolean).length === 1;
}
function resolveSizeFields(input: SizeFields) {
  if (input.sizePresetId) return { sizePresetId: input.sizePresetId };
  if (input.exactSize) return { exactSize: input.exactSize };
  return { aspectRatio: input.aspectRatio, resolution: input.resolution ?? "1k" };
}

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
 * Builds the prompt for ONE contact-sheet image containing all 6 angles —
 * a single request to the model, never 6 separate generations. The 6-cell
 * layout (2 large full-body cells + 4 portrait cells) is fixed,
 * product-defined; everything else (style phrase, appearance description,
 * outfit description) is real, user-chosen input folded in verbatim.
 *
 * No model this app integrates with has a native "contact sheet" or
 * "multi-panel layout" parameter (confirmed by reading every adapter in
 * providers/ — each is a plain text/image-to-image endpoint) — the grid
 * can only be requested via an explicit, highly literal prompt
 * description, with no guarantee the model actually honors all 6 cells,
 * their exact positions, or keeps every cell non-overlapping. This is
 * disclosed to the user (see the status line in character-builder.tsx)
 * rather than assumed.
 */
function buildContactSheetPrompt(
  gender: CharacterGender,
  ethnicity: CharacterEthnicity,
  age: number,
  stylePhrase: string,
  appearanceDescription: string,
  outfitDescription: string,
  hasOutfitImageReference: boolean
): string {
  const subject = genderSubjectPhrase(gender, ethnicity, age);
  // Negative prompts are never sent to either real provider in this app
  // (Higgsfield Soul and Marketing Studio both report
  // supportsNegativePrompt: false — see their describeAdjustments), so
  // every constraint has to live in this positive prompt text.
  const identityRef = hasOutfitImageReference ? "ảnh tham chiếu THỨ NHẤT (khuôn mặt)" : "ảnh tham chiếu đính kèm";
  const intro = `Tạo MỘT bức ảnh contact sheet (character sheet) DUY NHẤT, tỷ lệ khung hình 16:9, nền TRẮNG tinh liền mạch trên toàn bộ khung hình, không viền dày, không chữ, không nhãn, không watermark, không logo. Ảnh chia thành một lưới rõ ràng gồm ĐÚNG 6 ô, các ô tách biệt nhau bằng khoảng trắng, không chồng lấn lên nhau.`;
  const layout = `Bố cục lưới không đều gồm đúng 6 ô, đánh số từ trái sang phải: ô 1 là ảnh TOÀN THÂN CHÍNH DIỆN (thấy đủ từ đỉnh đầu đến bàn chân, không bị cắt mất đầu hoặc chân), ô 2 là ảnh TOÀN THÂN TỪ PHÍA SAU (cũng thấy đủ từ đầu đến chân), ô 3 là CHÂN DUNG CẬN MẶT CHÍNH DIỆN (thấy đầu và vai, nhìn thẳng vào máy ảnh), ô 4 là CHÂN DUNG GÓC 3/4 (thấy đầu và vai, mặt xoay chéo khoảng 45 độ). Hai ô cuối cùng bên phải PHẢI là khung hình NGANG (landscape), rộng hơn là cao, khác hẳn khung dọc của 4 ô trước — ô 5 là CHÂN DUNG GÓC NGHIÊNG RÕ (profile hoặc gần-profile), cắt từ vai/ngực trở lên, KHÔNG phải ảnh toàn thân; ô 6 là CẬN MẶT CỰC GẦN, chính diện, khuôn mặt chiếm phần lớn khung hình (giống kiểu crop macro cận mặt), có thể thấy một phần tóc và tai nhưng KHÔNG được cắt mất trán hoặc cằm, và KHÔNG để thân người, trang phục hay nền chiếm diện tích đáng kể trong ô này. Không lặp lại cùng một góc chụp ở hai ô khác nhau.`;
  const identity = `Cả 6 ô đều là CÙNG MỘT NGƯỜI: ${subject}, khuôn mặt giống hệt ${identityRef}, cùng độ tuổi trưởng thành, cùng kiểu tóc, cùng vóc dáng, cùng trang phục, cùng màu sắc và phụ kiện — không được đổi khác giữa các ô. Ánh sáng studio đều, chuyên nghiệp, giống nhau ở mọi ô.`;
  const outfitImageInstruction = hasOutfitImageReference
    ? "Ảnh tham chiếu THỨ HAI chỉ dùng để lấy thông tin TRANG PHỤC: kiểu dáng, màu sắc, họa tiết, chất liệu và phụ kiện của bộ trang phục trong ảnh đó — giữ đúng các chi tiết này ở cả 6 ô. Tuyệt đối KHÔNG lấy khuôn mặt, người mẫu, tư thế, nền hay bố cục từ ảnh tham chiếu thứ hai; khuôn mặt, danh tính và nền trắng của ảnh kết quả luôn theo ảnh tham chiếu thứ nhất và các chỉ dẫn ở trên."
    : null;
  const appearance = appearanceDescription.trim();
  const outfit = outfitDescription.trim();
  return [
    intro,
    layout,
    identity,
    stylePhrase ? `Phong cách: ${stylePhrase}.` : null,
    appearance ? `Ngoại hình: ${appearance}.` : null,
    outfit ? `Trang phục: ${outfit}.` : null,
    outfitImageInstruction,
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
    `Một bức ảnh DUY NHẤT: ảnh chân dung cận mặt của ${subject}, nhìn thẳng vào máy ảnh, biểu cảm trung tính, nền phông trường quay màu TRẮNG tinh liền mạch, ánh sáng studio chuyên nghiệp, chỉ một người duy nhất trong khung hình — không phải ảnh ghép, không phải lưới nhiều ảnh nhỏ, không chữ, không watermark.`,
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

const generateCharacterFaceSchema = z
  .object({
    brandId: z.string().uuid(),
    gender: z.enum(GENDER_IDS),
    ethnicity: z.enum(ETHNICITY_IDS).default("vietnamese"),
    age: ageSchema.default(22),
    style: z.enum(STYLE_IDS).default("photo"),
    customStyle: z.string().trim().max(MAX_STYLE_LENGTH, "Mô tả phong cách quá dài.").default(""),
    appearanceDescription: z.string().trim().max(MAX_APPEARANCE_LENGTH, "Mô tả ngoại hình quá dài.").default(""),
    model: z.string().trim().min(1).default("auto"),
  })
  .merge(sizeFieldsSchema)
  .refine(hasExactlyOneSizeSource, { message: "Cần chọn đúng một kích thước.", path: ["sizePresetId"] });

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
    ...resolveSizeFields(input),
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
    return err("DB_ERROR", describeCharactersTableError(insertError));
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
  // Only meaningful when the resolved model is Marketing Studio (the one
  // model whose real schema has a resolution tier at all — see
  // marketing-studio-provider.ts); ignored otherwise.
  resolution: z.enum(MARKETING_STUDIO_RESOLUTIONS).default("2k"),
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
 * Generates a character sheet as ONE image from ONE model call — not 6
 * separate generations stitched together server-side (that was this
 * function's previous design; see git history / compose-sheet.ts, now
 * unused, if that approach is ever needed again). `buildContactSheetPrompt`
 * describes all 6 required cells in a single prompt, and exactly one
 * `generateImages()` call is made, with `singleModelOnly: true` so a
 * provider failure is reported honestly instead of silently retried on a
 * different model that might not support the same aspect_ratio/
 * reference-image params this specific request needs (see schema.ts).
 *
 * Only Marketing Studio's confirmed schema has both `aspect_ratio` (so
 * "16:9" can be requested directly) and a 2-image reference slot (so the
 * outfit photo can be sent alongside the face) — see
 * marketing-studio-provider.ts's own doc comment, sourced from live API
 * probes. When a different model is selected/resolved, this falls back to
 * requesting 16:9 via `exactSize` pixel dimensions (the same pattern every
 * other non-Marketing-Studio request in this app already uses for an
 * arbitrary ratio) and sends only the single face reference — the outfit
 * image is never silently dropped-but-claimed-sent; `outfitImageSent`
 * reports the truth either way, and the UI (character-builder.tsx)
 * discloses the limitation when it's false.
 *
 * No model this app integrates with has a native "contact sheet" layout
 * parameter — whether the result actually contains all 6 cells, correctly
 * positioned and non-overlapping, depends entirely on how well the model
 * follows the literal prompt description. This is never asserted as
 * guaranteed, only requested.
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

  // Resolve what model will ACTUALLY be used before deciding the size/
  // reference shape to send — "auto" never resolves to Marketing Studio
  // (it's deliberately excluded from the default fallback order, see
  // providers/index.ts's own comment: its aspect_ratio/resolution params
  // can't be approximated from another model's pixel width/height), so
  // this is the only reliable way to know whether aspect_ratio/resolution
  // and a 2-image reference are really about to be honored.
  const resolvedChain = resolveModelChain(input.model);
  const effectiveModelId = resolvedChain[0] ?? "demo";
  const effectiveModel = getModel(effectiveModelId);
  const supportsContactSheetParams = effectiveModel.capabilities.supportsAspectRatioResolution;

  const outfitImageSent = Boolean(input.outfitReferenceImageUrl) && supportsContactSheetParams;
  const referenceFields = outfitImageSent
    ? { referenceImageUrl: faceUrl, referenceImageUrls: [faceUrl, input.outfitReferenceImageUrl!] }
    : { referenceImageUrl: faceUrl };
  // 1920×1080 — the same 16:9 pixel size every other non-Marketing-Studio
  // request in this app would compute for this ratio (see
  // character-builder.tsx's own pixelsForRatio, mirrored here server-side
  // since this field is never user-chosen for this feature).
  const sizeFields = supportsContactSheetParams
    ? { aspectRatio: "16:9" as const, resolution: input.resolution }
    : { exactSize: { width: 1920, height: 1080 } };

  const stylePhrase = resolveStylePromptText(input.style, input.customStyle);
  const sheetId = crypto.randomUUID();

  const result = await generateImages({
    brandId: input.brandId,
    prompt: buildContactSheetPrompt(
      character.gender,
      character.ethnicity,
      character.age,
      stylePhrase,
      input.appearanceDescription,
      input.outfitDescription,
      outfitImageSent
    ),
    negativePrompt: input.negativePrompt,
    ...sizeFields,
    count: 1,
    model: input.model,
    singleModelOnly: true,
    ...referenceFields,
  });

  if (!result.ok) {
    return err(result.error.code, result.error.message);
  }

  // "composite" already means "the one character-sheet image for this
  // sheetId" everywhere else in this codebase (character-queries.ts,
  // character-builder.tsx) — reused here rather than inventing a new
  // view value, even though this image is now generated directly by the
  // model instead of composed server-side from several real jobs.
  const { error: updateError } = await supabase
    .from("generation_jobs")
    .update({ character_id: input.characterId, character_view: "composite", character_sheet_id: sheetId })
    .eq("id", result.data.jobId);
  if (updateError) console.error("[createCharacterSheet] link job", updateError);

  const results: CharacterSheetViewResult[] = [{ view: "composite", ok: true, jobId: result.data.jobId, error: null }];

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
