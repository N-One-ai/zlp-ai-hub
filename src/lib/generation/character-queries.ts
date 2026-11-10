import { createClient } from "@/lib/supabase/server";
import { resolveSignedAssetUrl } from "./storage";
import type { Character, CharacterSheet, CharacterSheetViewItem, CharacterView } from "@/types/character";

/**
 * Plain reads for Server Components — not Server Actions. RLS ("view
 * characters in own workspace") already scopes this to the caller's
 * workspace. Fails closed (empty array) rather than throwing when the
 * `characters` table doesn't exist yet (migration 0008 not applied in
 * this environment) — the page still renders, with a clear banner from
 * the caller rather than a hard crash. See README's standing convention:
 * every migration in this repo is applied manually, never automatically.
 */
export async function getCharacters(workspaceId: string): Promise<Character[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) console.error("[getCharacters]", error);
    return [];
  }

  return Promise.all(
    data.map(async (row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      displayName: row.display_name,
      tagName: row.tag_name,
      gender: row.gender,
      ethnicity: row.ethnicity,
      age: row.age,
      faceSource: row.face_source,
      faceUrl: await resolveSignedAssetUrl(supabase, row.face_storage_path),
      faceLocked: row.face_locked,
      consentConfirmed: row.consent_confirmed,
      createdAt: row.created_at,
    }))
  );
}

export async function getCharacter(characterId: string): Promise<Character | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("characters").select("*").eq("id", characterId).maybeSingle();
  if (error || !row) {
    if (error) console.error("[getCharacter]", error);
    return null;
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    displayName: row.display_name,
    tagName: row.tag_name,
    gender: row.gender,
    ethnicity: row.ethnicity,
    age: row.age,
    faceSource: row.face_source,
    faceUrl: await resolveSignedAssetUrl(supabase, row.face_storage_path),
    faceLocked: row.face_locked,
    consentConfirmed: row.consent_confirmed,
    createdAt: row.created_at,
  };
}

const VIEW_ORDER: CharacterView[] = [
  "front",
  "back",
  "portrait",
  "portrait_side",
  "portrait_profile",
  "portrait_detail",
  "side", // legacy-only (pre-redesign sheets)
  "composite",
];

/**
 * Every "Tạo bảng nhân vật" click's generation_jobs rows, grouped by
 * their shared character_sheet_id (set by createCharacterSheet right
 * after each job is created — see character-actions.ts), newest sheet
 * first. Mirrors getGenerationJob()'s savedAssetId join (lib/generation/
 * queries.ts) so each view can show "Đã lưu" the same way. Throws on a
 * real query error (instead of failing closed to []) so the caller can
 * tell "no sheets yet" apart from "couldn't load sheets" — see
 * getCharacterSheetsAction in character-actions.ts, which is what turns
 * this into the ActionResult the UI actually branches on.
 */
export async function getCharacterSheets(characterId: string, limit = 20): Promise<CharacterSheet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id, status, error, output, attempts, prompt, requested_model, final_model, character_view, character_sheet_id, created_at")
    .eq("character_id", characterId)
    .not("character_sheet_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit * VIEW_ORDER.length);

  if (error) {
    console.error("[getCharacterSheets]", error);
    throw new Error(error.message);
  }
  if (!data) return [];

  const jobIds = data.map((j) => j.id);
  const { data: savedAssets } = await supabase
    .from("creative_assets")
    .select("id, source_generation_job_id")
    .in("source_generation_job_id", jobIds.length > 0 ? jobIds : ["00000000-0000-0000-0000-000000000000"]);
  const savedByJobId = new Map((savedAssets ?? []).map((a) => [a.source_generation_job_id, a.id]));

  const sheets = new Map<string, CharacterSheet>();
  for (const job of data) {
    const sheetId = job.character_sheet_id as string;
    if (!sheets.has(sheetId)) {
      sheets.set(sheetId, { sheetId, characterId, createdAt: job.created_at, views: [] });
    }
    const sheet = sheets.get(sheetId)!;
    const firstOutput = job.output[0] ?? null;
    const item: CharacterSheetViewItem = {
      view: (job.character_view as CharacterView) ?? "front",
      jobId: job.id,
      status: job.status,
      url: firstOutput ? await resolveSignedAssetUrl(supabase, firstOutput.path) : null,
      width: firstOutput?.width ?? null,
      height: firstOutput?.height ?? null,
      isDemo: firstOutput?.isDemo ?? false,
      savedAssetId: savedByJobId.get(job.id) ?? null,
      error: job.error,
      prompt: job.prompt,
      requestedModel: job.requested_model,
      finalModel: job.final_model,
      attempts: job.attempts,
    };
    sheet.views.push(item);
  }

  const ordered = Array.from(sheets.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const sheet of ordered) {
    sheet.views.sort((a, b) => VIEW_ORDER.indexOf(a.view) - VIEW_ORDER.indexOf(b.view));
  }
  return ordered.slice(0, limit);
}
