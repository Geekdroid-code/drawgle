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
          status: ScreenStatus;
          position_x: number;
          position_y: number;
          sort_index: number;
          error: string | null;
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
          status?: ScreenStatus;
          position_x: number;
          position_y: number;
          sort_index: number;
          error?: string | null;
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
          status?: ScreenStatus;
          position_x?: number;
          position_y?: number;
          sort_index?: number;
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
    };
    Views: {};
    Functions: {
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
    };
    Enums: {
      project_status: ProjectStatus;
      generation_status: GenerationStatus;
      screen_status: ScreenStatus;
      message_role: MessageRole;
    };
  };
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type GenerationRunRow = Database["public"]["Tables"]["generation_runs"]["Row"];
export type ScreenRow = Database["public"]["Tables"]["screens"]["Row"];
export type ScreenMessageRow = Database["public"]["Tables"]["screen_messages"]["Row"];