export type LogLevel = 'info' | 'error' | 'warn' | 'success';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface ScrapeProgress {
  jobId: string;
  status: 'idle' | 'running' | 'stopped' | 'completed' | 'error';
  totalUrls: number;
  processedUrls: number;
  currentUrl: string | null;
  logs: LogEntry[];
}

export interface ScrapeRequest {
  urls: string[];
  fields: string[];
  prompt: string;
  summarizePrompt: string;
  fieldPrompt: string;
  localLlmModel: string;
}

export interface AppSettings {
  CLOUD_LLM_URL: string;
  CLOUD_LLM_API_KEY: string;
  LOCAL_LLM_MODEL: string;
  OLLAMA_MODELS: string;
  OUTPUT_FOLDER: string;
}

export interface FieldResult {
  field: string;
  value: string | null;
  confidence: string;
  sourcePages: string[];
}

export interface UrlScrapeResult {
  url: string;
  fields: FieldResult[];
  pagesScraped: number;
  skipped: boolean;
  skipReason?: string;
}

export const LOCAL_LLM_OPTIONS = [
  { id: 'gemma4:e4b', label: 'Gemma 4 (E4B)' },
  { id: 'qwen3:8b', label: 'Qwen 3 (8B)' },
  { id: 'qwen2.5:7b', label: 'Qwen 2.5 (7B)' },
] as const;
