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
  summarizePrompt: string;
  fieldPrompt: string;
  localLlmModel: string;
}

export interface PromptDefaults {
  summarizePrompt: string;
  fieldPrompt: string;
}

export interface OutputField {
  field_name: string;
  extract_hint: string;
}

export interface Project {
  project_id: string;
  project_name: string;
  website_urls: string[];
  output_fields: OutputField[];
  main_prompt: string;
  summarize_prompt: string;
  field_extract_prompt: string;
  local_llm: string;
}

export interface Result {
  page_url: string;
  field_name: string;
  field_value: string;
}

export interface Execution {
  execution_id: string;
  execution_label: string;
  execution_time: string;
  project: Project;
  results: Result[];
}

export interface Scrape {
  scrape_id: string;
  execution_id: string;
  page_url: string;
  scrape_date: string;
  scraped_text: string;
  summarized_text: string;
}
