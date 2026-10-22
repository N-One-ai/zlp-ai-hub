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
