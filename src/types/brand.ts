import type {
  BrandColor,
  BrandFonts,
  BrandStatus,
  ExportFormat,
  LogoRules,
  SafeZone,
  TemplateLayout,
} from "./database";

export interface Brand {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: BrandStatus;
  avatarUrl: string | null;
  currentGuidelineVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Each variant carries both the raw storage path (needed to carry an
 * unchanged logo forward into the NEXT guideline version on save — see
 * brand-guideline-editor.tsx) and a short-lived signed URL for display.
 * Never a public URL — see migration 0002's comment on the brand-assets
 * bucket. Both null when that variant hasn't been uploaded. */
export interface GuidelineLogos {
  primaryPath: string | null;
  primaryUrl: string | null;
  secondaryPath: string | null;
  secondaryUrl: string | null;
  lightPath: string | null;
  lightUrl: string | null;
  darkPath: string | null;
  darkUrl: string | null;
}

export interface GuidelineVersion {
  id: string;
  brandId: string;
  version: number;
  logos: GuidelineLogos;
  colors: BrandColor[];
  fonts: BrandFonts;
  safeZone: SafeZone;
  logoRules: LogoRules;
  layoutNotes: string;
  createdAt: string;
}

export interface SizePreset {
  id: string;
  workspaceId: string;
  name: string;
  channel: string;
  width: number;
  height: number;
  exportFormat: ExportFormat;
}

export interface Template {
  id: string;
  brandId: string;
  name: string;
  sizePresetId: string | null;
  layout: TemplateLayout;
  status: "active" | "archived";
}

/** What's missing before a brand is ready to use for generation — shown
 * as the "preview guideline + cảnh báo thiếu cấu hình" per PRD §8.2. Only
 * ever computed from real stored data, never guessed. */
export interface BrandReadiness {
  hasLogo: boolean;
  hasColors: boolean;
  hasFonts: boolean;
  hasSizePreset: boolean;
  isReady: boolean;
}
