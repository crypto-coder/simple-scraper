import { randomUUID } from 'crypto';
import { DEFAULT_FIELD_PROMPT, DEFAULT_SUMMARIZE_PROMPT } from '../prompts';
import type { Project, ScrapeRequest } from '../types';

export async function triggerScrapeWorkflow(
  jobId: string,
  request: ScrapeRequest,
  executionId: string,
  project: Project
): Promise<void> {
  const webhookUrl =
    process.env.N8N_WEBHOOK_SCRAPE_URL ?? 'http://n8n:5678/webhook/scrape';

  const scraperBaseUrl =
    process.env.SCRAPER_BASE_URL ?? 'http://simple-scraper:3000';

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      executionId,
      project,
      urls: project.website_urls,
      fields: project.output_fields.map((f) => f.field_name),
      outputFields: project.output_fields,
      prompt: project.main_prompt,
      summarizePrompt: project.summarize_prompt || DEFAULT_SUMMARIZE_PROMPT,
      fieldPrompt: project.field_extract_prompt || DEFAULT_FIELD_PROMPT,
      localLlmModel: project.local_llm,
      scraperBaseUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n webhook failed (${res.status}): ${text}`);
  }
}

export function projectFromScrapeRequest(request: ScrapeRequest): Project {
  if (request.project) {
    return request.project;
  }

  return {
    project_id: randomUUID(),
    project_name: 'Untitled project',
    website_urls: request.urls,
    output_fields: request.fields.map((field_name) => ({ field_name, extract_hint: '' })),
    main_prompt: request.prompt,
    summarize_prompt: request.summarizePrompt,
    field_extract_prompt: request.fieldPrompt,
    local_llm: request.localLlmModel,
  };
}
