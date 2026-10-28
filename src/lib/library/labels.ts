import type { CreativeAssetStatus, CreativeAssetType } from "@/types/database";

/** Single source of truth for Library labels — reused by the filter
 * toolbar, the asset grid/list, and the status badges so a status or
 * type is never worded differently in two places. */
export const ASSET_TYPE_LABEL: Record<CreativeAssetType, string> = {
  image: "Ảnh",
  banner: "Banner",
  video: "Video",
};

export const ASSET_STATUS_LABEL: Record<CreativeAssetStatus, string> = {
  draft: "Nháp",
  ready: "Hoàn tất",
  archived: "Lưu trữ",
};

export const SORT_LABEL = {
  newest: "Mới nhất",
  oldest: "Cũ nhất",
} as const;
