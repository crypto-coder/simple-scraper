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
  scrapes: string[];
}

export interface Scrape {
  scrape_id: string;
  execution_id: string;
  page_url: string;
  scrape_date: string;
  scraped_text: string;
  summarized_text: string;
}

export type CouchDoc<T> = T & { _id?: string; _rev?: string };
