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

export interface FieldFinding {
  field: string;
  value: string;
  pageUrl: string;
  confidence?: string;
}

export interface WorkflowSaveInput {
  requestedFields: string[];
  findings: FieldFinding[];
  pageResults: PageWorkflowResult[];
}

/** Build final JSON: each field references page URL(s) where found, or "NOT FOUND". */
export function buildFinalOutputDocument(
  startUrl: string,
  requestedFields: string[],
  findings: FieldFinding[],
  pageResults: PageWorkflowResult[]
): Record<string, unknown> {
  const fieldsOutput: Record<string, unknown> = {};

  for (const fieldName of requestedFields) {
    const matches = findings.filter((f) => f.field === fieldName);
    if (matches.length === 0) {
      fieldsOutput[fieldName] = 'NOT FOUND';
    } else if (matches.length === 1) {
      fieldsOutput[fieldName] = {
        value: matches[0].value,
        pageUrl: matches[0].pageUrl,
        ...(matches[0].confidence ? { confidence: matches[0].confidence } : {}),
      };
    } else {
      fieldsOutput[fieldName] = matches.map((m) => ({
        value: m.value,
        pageUrl: m.pageUrl,
        ...(m.confidence ? { confidence: m.confidence } : {}),
      }));
    }
  }

  return {
    startUrl,
    pagesProcessed: pageResults.length,
    fields: fieldsOutput,
    findings,
    pages: pageResults.map((p) => ({
      pageUrl: p.pageUrl,
      summary: p.summary,
      fieldResults: p.fields.map((f) => ({
        field: f.field,
        value: f.value ?? 'NOT FOUND',
        present: f.value != null,
        confidence: f.confidence,
      })),
    })),
  };
}

export async function workflowSaveResult(
  startUrl: string,
  input: WorkflowSaveInput,
  config: WorkflowConfig = {}
): Promise<{ outputPath: string; document: Record<string, unknown> }> {
  const document = buildFinalOutputDocument(
    startUrl,
    input.requestedFields,
    input.findings,
    input.pageResults
  );

  if (getSettings().CLOUD_LLM_URL) {
    try {
      const cloudFormatted = await formatOutputWithCloudLlm(
        startUrl,
        input.findings.map((f) => ({
          field: f.field,
          value: f.value,
          confidence: f.confidence ?? 'unknown',
          sourcePages: [f.pageUrl],
        })),
        config.directions ?? '',
        input.pageResults.length
      );
      Object.assign(document, { cloudFormatted });
    } catch {
      // Keep deterministic per-page output when cloud formatting fails.
    }
  }

  const outputDir = getOutputDir();
  const slug = new URL(startUrl).hostname.replace(/\./g, '_') + '_' + Date.now();
  const outputPath = path.join(outputDir, `${slug}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  return { outputPath, document };
}
