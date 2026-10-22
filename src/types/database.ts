/**
 * Hand-written to match supabase/migrations/*.sql exactly.
 * Regenerate with `supabase gen types typescript` once the CLI is linked, if preferred.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: MembershipRole;
          status: MembershipStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: MembershipRole;
          status?: MembershipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: MembershipRole;
          status?: MembershipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string;
          status: BrandStatus;
          avatar_url: string | null;
          current_guideline_version_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string;
          status?: BrandStatus;
          avatar_url?: string | null;
          current_guideline_version_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          description?: string;
          status?: BrandStatus;
          avatar_url?: string | null;
          current_guideline_version_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      brand_guideline_versions: {
        Row: {
          id: string;
          brand_id: string;
          version: number;
          logo_primary_path: string | null;
          logo_secondary_path: string | null;
          logo_light_path: string | null;
          logo_dark_path: string | null;
          colors: BrandColor[];
          fonts: BrandFonts;
          safe_zone: SafeZone;
          logo_rules: LogoRules;
          layout_notes: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          version: number;
          logo_primary_path?: string | null;
          logo_secondary_path?: string | null;
          logo_light_path?: string | null;
          logo_dark_path?: string | null;
          colors?: BrandColor[];
          fonts?: BrandFonts;
          safe_zone?: SafeZone;
          logo_rules?: LogoRules;
          layout_notes?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          version?: number;
          logo_primary_path?: string | null;
          logo_secondary_path?: string | null;
          logo_light_path?: string | null;
          logo_dark_path?: string | null;
          colors?: BrandColor[];
          fonts?: BrandFonts;
          safe_zone?: SafeZone;
          logo_rules?: LogoRules;
          layout_notes?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      size_presets: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          channel: string;
          width: number;
          height: number;
          export_format: ExportFormat;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          channel?: string;
          width: number;
          height: number;
          export_format?: ExportFormat;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          channel?: string;
          width?: number;
          height?: number;
          export_format?: ExportFormat;
          created_at?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          size_preset_id: string | null;
          layout: TemplateLayout;
          status: "active" | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          size_preset_id?: string | null;
          layout?: TemplateLayout;
          status?: "active" | "archived";
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          size_preset_id?: string | null;
          layout?: TemplateLayout;
          status?: "active" | "archived";
          created_at?: string;
        };
        Relationships: [];
      };
      generation_jobs: {
        Row: {
          id: string;
          workspace_id: string;
          brand_id: string;
          user_id: string;
          job_type: "image";
          prompt: string;
          negative_prompt: string;
          params: GenerationParams;
          provider: string;
          model: string | null;
          status: GenerationJobStatus;
          error: string | null;
          output: GenerationOutputItem[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          brand_id: string;
          user_id: string;
          job_type?: "image";
          prompt: string;
          negative_prompt?: string;
          params?: GenerationParams;
          provider?: string;
          model?: string | null;
          status?: GenerationJobStatus;
          error?: string | null;
          output?: GenerationOutputItem[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          brand_id?: string;
          user_id?: string;
          job_type?: "image";
          prompt?: string;
          negative_prompt?: string;
          params?: GenerationParams;
          provider?: string;
          model?: string | null;
          status?: GenerationJobStatus;
          error?: string | null;
          output?: GenerationOutputItem[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creative_assets: {
        Row: {
          id: string;
          workspace_id: string;
          brand_id: string;
          owner_id: string | null;
          type: CreativeAssetType;
          name: string;
          campaign: string;
          tags: string[];
          status: CreativeAssetStatus;
          storage_path: string | null;
          width: number | null;
          height: number | null;
          prompt: string | null;
          source_generation_job_id: string | null;
          guideline_version_id: string | null;
          current_design_document_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          brand_id: string;
          owner_id?: string | null;
          type: CreativeAssetType;
          name?: string;
          campaign?: string;
          tags?: string[];
          status?: CreativeAssetStatus;
          storage_path?: string | null;
          width?: number | null;
          height?: number | null;
          prompt?: string | null;
          source_generation_job_id?: string | null;
          guideline_version_id?: string | null;
          current_design_document_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          brand_id?: string;
          owner_id?: string | null;
          type?: CreativeAssetType;
          name?: string;
          campaign?: string;
          tags?: string[];
          status?: CreativeAssetStatus;
          storage_path?: string | null;
          width?: number | null;
          height?: number | null;
          prompt?: string | null;
          source_generation_job_id?: string | null;
          guideline_version_id?: string | null;
          current_design_document_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      design_documents: {
        Row: {
          id: string;
          asset_id: string;
          version: number;
          size_preset_id: string | null;
          width: number;
          height: number;
          document: DesignDocumentContent;
          guideline_version_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          version: number;
          size_preset_id?: string | null;
          width: number;
          height: number;
          document?: DesignDocumentContent;
          guideline_version_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          version?: number;
          size_preset_id?: string | null;
          width?: number;
          height?: number;
          document?: DesignDocumentContent;
          guideline_version_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exports: {
        Row: {
          id: string;
          asset_id: string;
          design_document_id: string | null;
          format: ExportFormat;
          width: number;
          height: number;
          storage_path: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          design_document_id?: string | null;
          format: ExportFormat;
          width: number;
          height: number;
          storage_path: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          design_document_id?: string | null;
          format?: ExportFormat;
          width?: number;
          height?: number;
          storage_path?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_workspace_with_owner: {
        Args: { p_name: string; p_owner_id: string };
        Returns: string;
      };
      invite_member: {
        Args: { p_workspace_id: string; p_email: string; p_role: string };
        Returns: Database["public"]["Tables"]["memberships"]["Row"];
      };
      is_workspace_member: {
        Args: { p_workspace_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_workspace_admin: {
        Args: { p_workspace_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_workspace_contributor: {
        Args: { p_workspace_id: string; p_user_id: string };
        Returns: boolean;
      };
      create_guideline_version: {
        Args: {
          p_brand_id: string;
          p_logo_primary_path: string | null;
          p_logo_secondary_path: string | null;
          p_logo_light_path: string | null;
          p_logo_dark_path: string | null;
          p_colors: BrandColor[];
          p_fonts: BrandFonts;
          p_safe_zone: SafeZone;
          p_logo_rules: LogoRules;
          p_layout_notes: string;
        };
        Returns: Database["public"]["Tables"]["brand_guideline_versions"]["Row"];
      };
    };
  };
}

export type MembershipRole = "admin" | "creator" | "viewer";
export type MembershipStatus = "invited" | "active" | "revoked";
export type BrandStatus = "active" | "archived";
export type ExportFormat = "png" | "jpg";

export type ColorRole = "primary" | "secondary" | "background" | "text" | "accent";
export interface BrandColor {
  name: string;
  hex: string;
  role: ColorRole;
}

export interface FontChoice {
  family: string;
  fallback: string;
}
export interface BrandFonts {
  heading?: FontChoice;
  body?: FontChoice;
}

export interface SafeZone {
  topPx?: number;
  rightPx?: number;
  bottomPx?: number;
  leftPx?: number;
  notes?: string;
}

export type LogoBackground = "light" | "dark" | "either";
export interface LogoRules {
  preferredVariant?: "primary" | "secondary" | "light" | "dark";
  minSizePx?: number;
  clearSpacePx?: number;
  acceptableBackgrounds?: LogoBackground;
}

export interface TemplateLayout {
  logo?: { x: number; y: number; widthPx: number };
  textFields?: { id: string; label: string; x: number; y: number; maxWidthPx: number }[];
}

export type GenerationJobStatus = "queued" | "processing" | "succeeded" | "failed" | "cancelled";

export interface GenerationParams {
  aspectRatio: string;
  width: number;
  height: number;
  count: number;
  sizePresetId?: string | null;
}

export interface GenerationOutputItem {
  path: string;
  width: number;
  height: number;
  isDemo: boolean;
}

export type CreativeAssetType = "image" | "banner" | "video";
export type CreativeAssetStatus = "draft" | "ready" | "archived";

export type DesignLayerType = "background" | "image" | "text" | "logo" | "shape";
export type TextAlign = "left" | "center" | "right";
export type ShapeKind = "rect" | "ellipse";

/** One layer in a banner's editor state. Fields outside a layer's own
 * `type` are simply unused — kept as one flat shape (not a discriminated
 * union in storage) because jsonb has no notion of TS unions; the app
 * layer (src/types/design.ts) narrows this the same way the rest of the
 * codebase narrows jsonb-backed fields. */
export interface DesignLayer {
  id: string;
  type: DesignLayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
  // image / background / logo
  imagePath?: string;
  // text
  text?: string;
  fontFamily?: string;
  fontFallback?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: TextAlign;
  lineHeight?: number;
  letterSpacing?: number;
  // shape
  shapeKind?: ShapeKind;
  fill?: string;
}

export interface DesignDocumentContent {
  layers: DesignLayer[];
}
