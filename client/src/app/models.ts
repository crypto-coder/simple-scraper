export interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'success';
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

export interface LlmOption {
  id: string;
  label: string;
}

export interface AppSettings {
  CLOUD_LLM_URL: string;
  CLOUD_LLM_API_KEY: string;
  LOCAL_LLM_MODEL: string;
  OLLAMA_MODELS: string;
  OUTPUT_FOLDER: string;
}

export interface ScrapeRequest {
  urls: string[];
  fields: string[];
  prompt: string;
  localLlmModel: string;
}
