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
}

export interface LibraryAssetDetail extends LibraryAssetListItem {
  prompt: string | null;
  width: number | null;
  height: number | null;
  fileUrl: string | null;
  tags: string[];
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
