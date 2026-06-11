export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectStatus =
  | "draft"
  | "active"
  | "queued"
  | "generating"
  | "failed"
  | "completed"
  | "archived";

export type GenerationStatus = "queued" | "planning" | "building" | "completed" | "failed" | "canceled";

export type ScreenStatus = "queued" | "building" | "ready" | "failed";

export type MessageRole = "user" | "model" | "system";

export type ProjectMessageType =
  | "chat"
  | "edit_applied"
  | "screen_created"
  | "generation_started"
  | "generation_completed"
  | "error";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          prompt: string;
          status: ProjectStatus;
          project_charter: Json | null;
          design_tokens: Json | null;
          next_screen_x: number;
          screen_origin_y: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          prompt?: string;
          status?: ProjectStatus;
          project_charter?: Json | null;
          design_tokens?: Json | null;
          next_screen_x?: number;
          screen_origin_y?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          prompt?: string;
          status?: ProjectStatus;
          project_charter?: Json | null;
          design_tokens?: Json | null;
          next_screen_x?: number;
          screen_origin_y?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generation_runs: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          prompt: string;
          image_path: string | null;
          requested_screen_count: number | null;
          status: GenerationStatus;
          trigger_run_id: string | null;
          requires_bottom_nav: boolean;
          error: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id: string;
          prompt: string;
          image_path?: string | null;
          requested_screen_count?: number | null;
          status?: GenerationStatus;
          trigger_run_id?: string | null;
          requires_bottom_nav?: boolean;
          error?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          owner_id?: string;
          prompt?: string;
          image_path?: string | null;
          requested_screen_count?: number | null;
          status?: GenerationStatus;
          trigger_run_id?: string | null;
          requires_bottom_nav?: boolean;
          error?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      screens: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          generation_run_id: string | null;
          name: string;
          prompt: string;
          code: string;
          summary: string | null;
          embedding: number[] | null;
          block_index: Json | null;
          chrome_policy: Json | null;
          navigation_item_id: string | null;
          status: ScreenStatus;
          position_x: number;
          position_y: number;
          sort_index: number;
          error: string | null;
          trigger_run_id: string | null;
          stream_public_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id: string;
          generation_run_id?: string | null;
          name: string;
          prompt?: string;
          code?: string;
          summary?: string | null;
          embedding?: number[] | null;
          block_index?: Json | null;
          chrome_policy?: Json | null;
          navigation_item_id?: string | null;
          status?: ScreenStatus;
          position_x: number;
          position_y: number;
          sort_index: number;
          error?: string | null;
          trigger_run_id?: string | null;
          stream_public_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          owner_id?: string;
          generation_run_id?: string | null;
          name?: string;
          prompt?: string;
          code?: string;
          summary?: string | null;
          embedding?: number[] | null;
          block_index?: Json | null;
          chrome_policy?: Json | null;
          navigation_item_id?: string | null;
          status?: ScreenStatus;
          position_x?: number;
          position_y?: number;
          sort_index?: number;
          error?: string | null;
          trigger_run_id?: string | null;
          stream_public_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_navigation: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          plan: Json;
          shell_code: string;
          block_index: Json | null;
          status: ScreenStatus;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id: string;
          plan?: Json;
          shell_code?: string;
          block_index?: Json | null;
          status?: ScreenStatus;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          owner_id?: string;
          plan?: Json;
          shell_code?: string;
          block_index?: Json | null;
          status?: ScreenStatus;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      screen_messages: {
        Row: {
          id: string;
          screen_id: string;
          owner_id: string;
          role: MessageRole;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          screen_id: string;
          owner_id: string;
          role: MessageRole;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          screen_id?: string;
          owner_id?: string;
          role?: MessageRole;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      project_messages: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          screen_id: string | null;
          role: MessageRole;
          content: string;
          message_type: ProjectMessageType;
          metadata: Json;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id: string;
          screen_id?: string | null;
          role: MessageRole;
          content: string;
          message_type?: ProjectMessageType;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          owner_id?: string;
          screen_id?: string | null;
          role?: MessageRole;
          content?: string;
          message_type?: ProjectMessageType;
          metadata?: Json;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      visual_assets: {
        Row: {
          id: string;
          owner_id: string | null;
          created_by_project_id: string | null;
          subject: string;
          role: string;
          asset_type: string;
          source: string;
          provider: string;
          license: string | null;
          r2_key: string;
          public_url: string;
          width: number;
          height: number;
          has_alpha: boolean;
          dominant_colors: Json;
          safe_area: Json | null;
          tags: string[];
          reuse_key: string;
          embedding: number[] | null;
          quality_score: number;
          visibility: string;
          verification_status: string;
          verification_score: number | null;
          verification_notes: string | null;
          content_hash: string | null;
          mime_type: string | null;
          byte_size: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          created_by_project_id?: string | null;
          subject: string;
          role: string;
          asset_type: string;
          source: string;
          provider: string;
          license?: string | null;
          r2_key: string;
          public_url: string;
          width: number;
          height: number;
          has_alpha?: boolean;
          dominant_colors?: Json;
          safe_area?: Json | null;
          tags?: string[];
          reuse_key: string;
          embedding?: number[] | null;
          quality_score?: number;
          visibility?: string;
          verification_status?: string;
          verification_score?: number | null;
          verification_notes?: string | null;
          content_hash?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          created_by_project_id?: string | null;
          subject?: string;
          role?: string;
          asset_type?: string;
          source?: string;
          provider?: string;
          license?: string | null;
          r2_key?: string;
          public_url?: string;
          width?: number;
          height?: number;
          has_alpha?: boolean;
          dominant_colors?: Json;
          safe_area?: Json | null;
          tags?: string[];
          reuse_key?: string;
          embedding?: number[] | null;
          quality_score?: number;
          visibility?: string;
          verification_status?: string;
          verification_score?: number | null;
          verification_notes?: string | null;
          content_hash?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      visual_asset_variants: {
        Row: {
          id: string;
          asset_id: string;
          variant: string;
          r2_key: string;
          public_url: string;
          width: number;
          height: number;
          mime_type: string;
          byte_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          variant: string;
          r2_key: string;
          public_url: string;
          width: number;
          height: number;
          mime_type: string;
          byte_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          variant?: string;
          r2_key?: string;
          public_url?: string;
          width?: number;
          height?: number;
          mime_type?: string;
          byte_size?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_image_assets: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string;
          screen_id: string | null;
          r2_key: string;
          public_url: string;
          mime_type: string;
          byte_size: number;
          width: number | null;
          height: number | null;
          original_filename: string | null;
          target_drawgle_id: string | null;
          target_kind: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          project_id: string;
          screen_id?: string | null;
          r2_key: string;
          public_url: string;
          mime_type: string;
          byte_size: number;
          width?: number | null;
          height?: number | null;
          original_filename?: string | null;
          target_drawgle_id?: string | null;
          target_kind?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          project_id?: string;
          screen_id?: string | null;
          r2_key?: string;
          public_url?: string;
          mime_type?: string;
          byte_size?: number;
          width?: number | null;
          height?: number | null;
          original_filename?: string | null;
          target_drawgle_id?: string | null;
          target_kind?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      asset_generation_jobs: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string;
          requirement_id: string;
          reuse_key: string;
          provider: string;
          model: string;
          fal_request_id: string | null;
          status: string;
          request_payload: Json;
          response_payload: Json | null;
          asset_id: string | null;
          attempts: number;
          error: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          project_id: string;
          requirement_id: string;
          reuse_key: string;
          provider: string;
          model: string;
          fal_request_id?: string | null;
          status?: string;
          request_payload?: Json;
          response_payload?: Json | null;
          asset_id?: string | null;
          attempts?: number;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          project_id?: string;
          requirement_id?: string;
          reuse_key?: string;
          provider?: string;
          model?: string;
          fal_request_id?: string | null;
          status?: string;
          request_payload?: Json;
          response_payload?: Json | null;
          asset_id?: string | null;
          attempts?: number;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      project_asset_usages: {
        Row: {
          id: string;
          project_id: string;
          screen_id: string | null;
          generation_run_id: string | null;
          asset_id: string;
          requirement_id: string;
          screen_name: string;
          placement_hint: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          screen_id?: string | null;
          generation_run_id?: string | null;
          asset_id: string;
          requirement_id: string;
          screen_name: string;
          placement_hint: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          screen_id?: string | null;
          generation_run_id?: string | null;
          asset_id?: string;
          requirement_id?: string;
          screen_name?: string;
          placement_hint?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      match_screens: {
        Args: {
          query_embedding: number[];
          p_project_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          screen_id: string;
          name: string;
          summary: string;
          similarity: number;
        }[];
      };
      reserve_screen_slots: {
        Args: {
          input_project_id: string;
          input_slot_count: number;
        };
        Returns: {
          sort_index: number;
          position_x: number;
          position_y: number;
        }[];
      };
      match_project_messages: {
        Args: {
          query_embedding: number[];
          p_project_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          message_id: string;
          role: MessageRole;
          content: string;
          message_type: ProjectMessageType;
          screen_id: string | null;
          created_at: string;
          similarity: number;
        }[];
      };
      match_visual_assets: {
        Args: {
          query_embedding: number[];
          p_asset_type?: string | null;
          p_role?: string | null;
          p_has_alpha?: boolean | null;
          p_owner_id?: string | null;
          p_project_id?: string | null;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          asset_id: string;
          public_url: string;
          subject: string;
          role: string;
          asset_type: string;
          source: string;
          provider: string;
          width: number;
          height: number;
          has_alpha: boolean;
          tags: string[];
          similarity: number;
          quality_score: number;
        }[];
      };
    };
    Enums: {
      project_status: ProjectStatus;
      generation_status: GenerationStatus;
      screen_status: ScreenStatus;
      message_role: MessageRole;
      project_message_type: ProjectMessageType;
    };
  };
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type GenerationRunRow = Database["public"]["Tables"]["generation_runs"]["Row"];
export type ScreenRow = Database["public"]["Tables"]["screens"]["Row"];
export type ProjectNavigationRow = Database["public"]["Tables"]["project_navigation"]["Row"];
export type ScreenMessageRow = Database["public"]["Tables"]["screen_messages"]["Row"];
export type ProjectMessageRow = Database["public"]["Tables"]["project_messages"]["Row"];
export type VisualAssetRow = Database["public"]["Tables"]["visual_assets"]["Row"];
export type VisualAssetVariantRow = Database["public"]["Tables"]["visual_asset_variants"]["Row"];
export type UserImageAssetRow = Database["public"]["Tables"]["user_image_assets"]["Row"];
export type AssetGenerationJobRow = Database["public"]["Tables"]["asset_generation_jobs"]["Row"];
export type ProjectAssetUsageRow = Database["public"]["Tables"]["project_asset_usages"]["Row"];
