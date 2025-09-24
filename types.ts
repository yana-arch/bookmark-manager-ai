
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
