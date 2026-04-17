export interface DesignTokens {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  // Extensible for future Phase 1.2
}

export interface ProjectData {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  status: 'draft' | 'active';
  designTokens?: DesignTokens | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenData {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  code: string;
  prompt: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}
