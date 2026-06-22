import { DEFAULT_FIELD_PROMPT, DEFAULT_SUMMARIZE_PROMPT } from '../prompts';
import type { ScrapeRequest } from '../types';

export async function triggerScrapeWorkflow(jobId: string, request: ScrapeRequest): Promise<void> {
  const webhookUrl =
    process.env.N8N_WEBHOOK_SCRAPE_URL ?? 'http://n8n:5678/webhook/scrape';

  const scraperBaseUrl =
    process.env.SCRAPER_BASE_URL ?? 'http://simple-scraper:3000';

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      urls: request.urls,
      fields: request.fields,
      prompt: request.prompt,
      summarizePrompt: request.summarizePrompt || DEFAULT_SUMMARIZE_PROMPT,
      fieldPrompt: request.fieldPrompt || DEFAULT_FIELD_PROMPT,
      localLlmModel: request.localLlmModel,
      scraperBaseUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n webhook failed (${res.status}): ${text}`);
  }
}
