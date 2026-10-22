import type { DesignLayer } from "./database";

export type GuidelineCheckSeverity = "pass" | "review" | "fail";

export interface GuidelineCheckResult {
  id: string;
  label: string;
  severity: GuidelineCheckSeverity;
  reason: string;
  /** Whether this specific check, when failing, blocks export — PRD
   * §8.5: "Admin cấu hình lỗi nào chặn xuất; mặc định sai kích thước hoặc
   * thiếu logo theo mẫu bắt buộc chặn xuất, cảnh báo khác cho phép tiếp
   * tục." Phase 1 hardcodes the PRD's own stated defaults rather than
   * building an Admin configuration UI for this — see README. */
  blocksExport: boolean;
}

/** A layer with its imagePath (if any) resolved to a short-lived signed
 * URL for canvas rendering — never a public URL, same convention as
 * every other image in this app. */
export type ResolvedLayer = DesignLayer & { imageUrl?: string | null };
