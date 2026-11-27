import type { CreativeAssetStatus, CreativeAssetType } from "./database";

export interface LibraryAssetListItem {
  id: string;
  type: CreativeAssetType;
  name: string;
  brandId: string;
  brandName: string;
  campaign: string;
  status: CreativeAssetStatus;
  ownerId: string | null;
  ownerName: string;
  thumbnailUrl: string | null;
  createdAt: string;
  /** The CURRENT user's own favorite bookmark on this asset (see
   * migration 0017_asset_favorites.sql) — never a workspace-wide flag,
   * so this differs per viewer. */
  isFavorited: boolean;
}

export interface LibraryAssetDetail extends LibraryAssetListItem {
  prompt: string | null;
  width: number | null;
  height: number | null;
  fileUrl: string | null;
  tags: string[];
  /** True when this asset came from the "Xây dựng nhân vật" (Character
   * Builder) flow — derived from the linked generation_jobs row's own
   * character_id (set by createCharacterSheet in character-actions.ts),
   * since creative_assets itself has no character_id column. The detail
   * page uses this to tweak its layout for character portraits only
   * (hide the prompt block, show the image larger, show time alongside
   * the date), without touching the shared page for every other asset
   * type. */
  isCharacterAsset: boolean;
  /** Design document version history, only populated for type 'banner'. */
  versions: { id: string; version: number; createdAt: string }[];
  /** Which AI model actually produced this asset — null for uploads (no
   * source generation job) or when the job belongs to someone else (RLS
   * scopes generation_jobs to its own owner, not the whole workspace). */
  generation: {
    requestedModel: string;
    finalModel: string | null;
    /** From generation_jobs.params — "4:3"/"auto" etc. for models that use
     * an aspect-ratio string (e.g. Marketing Studio); a plain W:H ratio
     * label (derived from pixel width/height) for every other model. */
    aspectRatio: string | null;
    /** Resolution tier ("1k"/"2k"/"4k") — only set for Marketing Studio. */
    resolution: string | null;
  } | null;
}

export const LIBRARY_PAGE_SIZE = 20;

export interface LibraryFilters {
  search?: string;
  type?: CreativeAssetType;
  brandId?: string;
  ownerId?: string;
  status?: CreativeAssetStatus;
  sort?: "newest" | "oldest";
  page?: number;
}
