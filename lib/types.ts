export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export type ProjectStatus = 'draft' | 'active' | 'queued' | 'generating' | 'failed' | 'completed' | 'archived';

export type ScreenStatus = 'queued' | 'building' | 'ready' | 'failed';

export type GenerationStatus = 'queued' | 'planning' | 'building' | 'completed' | 'failed' | 'canceled';

export const ACTIVE_GENERATION_STATUSES = ['queued', 'planning', 'building'] as const;

export const TERMINAL_GENERATION_STATUSES = ['completed', 'failed', 'canceled'] as const;

export function isActiveGenerationStatus(status: GenerationStatus) {
  return ACTIVE_GENERATION_STATUSES.includes(status as (typeof ACTIVE_GENERATION_STATUSES)[number]);
}

export function isTerminalGenerationStatus(status: GenerationStatus) {
  return TERMINAL_GENERATION_STATUSES.includes(status as (typeof TERMINAL_GENERATION_STATUSES)[number]);
}

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface PromptImagePayload {
  data: string;
  mimeType: string;
}

export interface DesignTokens {
  system_schema?: string;
  tokens?: {
    color?: {
      background?: {
        primary?: string;
        surface_elevated?: string;
      };
      text?: {
        high_emphasis?: string;
        medium_emphasis?: string;
        low_emphasis?: string;
        action_label?: string;
      };
      action?: {
        primary_gradient_start?: string;
        primary_gradient_end?: string;
        on_surface_white_bg?: string;
        disabled?: string;
        primary?: string;
      };
      border?: {
        divider?: string;
        focused?: string;
      };
      [key: string]: JsonValue | undefined;
    };
    typography?: {
      font_family?: string;
      title_main?: {
        size?: string;
        weight?: string | number;
        line_height?: string;
      };
      body_primary?: {
        size?: string;
        weight?: string | number;
        line_height?: string;
      };
      [key: string]: JsonValue | undefined;
    };
    spacing?: Record<string, string>;
    mobile_layout?: Record<string, string>;
    sizing?: Record<string, string>;
    radii?: Record<string, string>;
    border_widths?: Record<string, string>;
    elevation?: Record<string, string>;
    [key: string]: JsonValue | undefined;
  };
  [key: string]: JsonValue | undefined;
}

export interface ScreenPlan {
  name: string;
  type: 'root' | 'detail';
  description: string;
}

export interface ProjectData {
  id: string;
  ownerId?: string;
  userId: string;
  name: string;
  prompt: string;
  status: ProjectStatus;
  designTokens?: DesignTokens | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenData {
  id: string;
  projectId: string;
  ownerId?: string;
  userId: string;
  generationRunId?: string | null;
  name: string;
  code: string;
  prompt: string;
  x: number;
  y: number;
  sortIndex?: number;
  status?: ScreenStatus;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationRunData {
  id: string;
  projectId: string;
  ownerId: string;
  prompt: string;
  imagePath?: string | null;
  requestedScreenCount?: number | null;
  status: GenerationStatus;
  triggerRunId?: string | null;
  requiresBottomNav?: boolean;
  error?: string | null;
  metadata?: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
}

export interface BuildScreenInput {
  screenPlan: ScreenPlan;
  designTokens?: DesignTokens | null;
  prompt: string;
  image?: PromptImagePayload | null;
  requiresBottomNav: boolean;
}
