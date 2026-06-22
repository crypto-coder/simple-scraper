import fs from 'fs';
import path from 'path';
import { getSettings } from '../config';
import { DEFAULT_FIELD_PROMPT, DEFAULT_SUMMARIZE_PROMPT } from '../prompts';
import type { FieldResult } from '../types';
import { formatOutputWithCloudLlm } from './cloudLlm';
import { answerFieldQuestion, ensureModelAvailable, summarizeText } from './localLlm';
import { discoverPageUrls, getOutputDir, scrapePageText } from './spider';

export interface WorkflowConfig {
  directions?: string;
  summarizePrompt?: string;
  fieldPrompt?: string;
  localLlmModel?: string;
}

async function resolveModel(model?: string): Promise<string> {
  const settings = getSettings();
  const modelName = model ?? settings.LOCAL_LLM_MODEL;
  await ensureModelAvailable(modelName);
  return modelName;
}

export async function workflowSpider(startUrl: string): Promise<{ url: string; pages: string[] }> {
  const pages = await discoverPageUrls(startUrl);
  return { url: startUrl, pages };
}

export async function workflowScrapePage(pageUrl: string): Promise<{
  url: string;
  text: string;
  textLength: number;
}> {
  const result = await scrapePageText(pageUrl);
  return { ...result, textLength: result.text.length };
}

export async function workflowSummarize(
  text: string,
  config: WorkflowConfig = {}
): Promise<{ summary: string; summaryLength: number }> {
  await resolveModel(config.localLlmModel);
  const summary = await summarizeText(
    text,
    config.summarizePrompt ?? DEFAULT_SUMMARIZE_PROMPT,
    config.localLlmModel
  );
  return { summary, summaryLength: summary.length };
}

export async function workflowExtractField(
  field: string,
  context: string,
  config: WorkflowConfig = {}
): Promise<FieldResult & { fieldQuestion: string }> {
  await resolveModel(config.localLlmModel);
  const answer = await answerFieldQuestion(
    field,
    context,
    config.directions ?? '',
    config.fieldPrompt ?? DEFAULT_FIELD_PROMPT,
    config.localLlmModel
  );
  const label = field.replace(/[_-]+/g, ' ').trim();
  return {
    field,
    value: answer.present ? answer.value : null,
    confidence: answer.confidence,
    sourcePages: [],
    fieldQuestion: `What is the ${label}?`,
  };
}

export interface PageWorkflowResult {
  pageUrl: string;
  summary: string;
  fields: FieldResult[];
}

export async function workflowSaveResult(
  startUrl: string,
  pageResults: PageWorkflowResult[],
  config: WorkflowConfig = {}
): Promise<{ outputPath: string; document: Record<string, unknown> }> {
  const allFields = mergeFieldsAcrossPages(pageResults);
  const document = await formatOutputWithCloudLlm(
    startUrl,
    allFields,
    config.directions ?? '',
    pageResults.length
  );

  const enriched = {
    ...document,
    startUrl,
    pagesProcessed: pageResults.length,
    pageResults: pageResults.map((p) => ({
      pageUrl: p.pageUrl,
      summary: p.summary,
      fields: Object.fromEntries(p.fields.map((f) => [f.field, f.value])),
    })),
  };

  const outputDir = getOutputDir();
  const slug = new URL(startUrl).hostname.replace(/\./g, '_') + '_' + Date.now();
  const outputPath = path.join(outputDir, `${slug}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2), 'utf-8');

  return { outputPath, document: enriched };
}

/** Prefer first non-null value per field across pages. */
function mergeFieldsAcrossPages(pageResults: PageWorkflowResult[]): FieldResult[] {
  const byField = new Map<string, FieldResult>();

  for (const page of pageResults) {
    for (const field of page.fields) {
      const existing = byField.get(field.field);
      if (!existing || (existing.value == null && field.value != null)) {
        byField.set(field.field, {
          ...field,
          sourcePages: field.value != null ? [page.pageUrl] : [],
        });
      } else if (existing.value != null && field.value != null) {
        existing.sourcePages = [...new Set([...existing.sourcePages, page.pageUrl])];
      }
    }
  }

  return Array.from(byField.values());
}
