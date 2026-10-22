/**
 * PRD §14 — "Ghi nhận tối thiểu" — the exact 10 events listed, typed so a
 * call site can't accidentally pass prompt text or other sensitive
 * content as a property. Every event implicitly carries user/workspace id
 * and a timestamp (added by trackEvent itself, see ./track.ts) — never
 * passed in here.
 */
export type AnalyticsEvent =
  | { name: "login_success" }
  | { name: "brand_selected"; brandId: string }
  | { name: "generation_started"; brandId: string; count: number }
  | { name: "generation_succeeded"; jobId: string; count: number; provider: string }
  | { name: "generation_failed"; jobId: string; provider: string }
  | { name: "banner_editor_opened"; assetId: string; brandId: string }
  | { name: "guideline_check_completed"; assetId: string; failCount: number; reviewCount: number }
  | { name: "export_succeeded"; assetId: string; format: string }
  | { name: "asset_downloaded"; assetId: string; assetType: string }
  | { name: "asset_deleted"; assetId: string; assetType: string };
