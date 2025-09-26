
export interface Bookmark {
  id: string;
  type: 'bookmark';
  title: string;
  url: string;
  addDate?: string;
  icon?: string;
  tags: string[];
}

export interface BookmarkFolder {
  id: string;
  type: 'folder';
  name: string;
  children: BookmarkNode[];
  addDate?: string;
  lastModified?: string;
}

export type BookmarkNode = Bookmark | BookmarkFolder;

export enum ViewMode {
  Tree = 'tree',
  Grid = 'grid',
  List = 'list',
}

export type ProviderName = 'openai' | 'gemini' | 'openrouter' | 'anthropic' | 'azure' | 'grok' | 'ollama' | 'custom';

export interface AiConfig {
  id: string;             // uuid
  name: string;           // tên hiển thị
  provider: ProviderName; // e.g. 'openai' | 'gemini' | 'anthropic' | 'openrouter' | 'azure' | 'ollama' | 'custom'
  baseURL?: string;       // chỉ khi provider là custom hoặc azure/ollama
  apiKey?: string;        // có thể null nếu dùng env-based default
  modelId: string;        // ví dụ: 'gpt-4o-mini', 'claude-2.1'
  metadata?: Record<string, any>; // tùy chọn (region, azure deploymentId, extraHeaders...)
  isDefault?: boolean;    // cấu hình mặc định
  createdAt?: string;
}

export interface AiConfigGroup {
  id: string;          // uuid
  name: string;        // Tên hiển thị cho nhóm
  aiConfigIds: string[]; // Mảng các ID của các AiConfig trong nhóm này
  createdAt?: string;
}

export interface GenerativeModel {
  id: string; // config id
  provider: ProviderName;
  generateContent: (prompt: string, opts?: any) => Promise<{ text: string; raw?: any }>;
  streamGenerate?: (prompt: string, opts: any, onDelta: (delta: string)=>void) => Promise<void>;
}

export interface ApiError {
  code: string;
  message: string;
  provider?: ProviderName;
  status?: number;
  raw?: any;
}

export interface ProcessingLog {
  id: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface OrganizationSuggestion {
  bookmarkId: string;
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
  suggestedTags: string[];
}

export interface OrganizationConflict {
  bookmarkId: string;
  currentCategory: string;
  suggestedCategory: string;
  confidence: number;
}

export interface DuplicateGroup {
  primaryBookmark: Bookmark;
  duplicates: Bookmark[];
  mergeStrategy: 'keep_primary' | 'merge_tags' | 'keep_newest';
}

export interface OrganizationPlan {
  suggestions: OrganizationSuggestion[];
  conflicts: OrganizationConflict[];
  duplicates: DuplicateGroup[];
  newFolders: string[];
  metadata: {
    totalBookmarks: number;
    processedBookmarks: number;
    createdAt: Date;
    aiConfigsUsed: string[];
  };
}
