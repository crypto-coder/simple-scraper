import { getSettings } from '../config';
import { DEFAULT_FIELD_PROMPT, DEFAULT_SUMMARIZE_PROMPT } from '../prompts';
import type { FieldResult } from '../types';
import { answerFieldQuestion, ensureModelAvailable, summarizeText } from './localLlm';
import { discoverPageUrls, scrapePageText } from './spider';

interface WorkflowConfig {
  directions?: string;
  summarizePrompt?: string;
  fieldPrompt?: string;
  localLlmModel?: string;
  extractHint?: string;
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
  ok: boolean;
  error?: string;
}> {
  const result = await scrapePageText(pageUrl);
  return { ...result, textLength: result.text.length };
}

export async function workflowSummarize(
  text: string,
  config: WorkflowConfig = {}
): Promise<{ summary: string; summaryLength: number }> {
  if (!text.trim()) {
    return { summary: '', summaryLength: 0 };
  }
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
  const label = field.replace(/[_-]+/g, ' ').trim();
  const fieldQuestion = `What is the ${label}?`;

  if (!context.trim()) {
    return {
      field,
      value: null,
      confidence: 'none',
      sourcePages: [],
      fieldQuestion,
    };
  }

  await resolveModel(config.localLlmModel);
  const hint = config.extractHint?.trim();
  const directions = hint
    ? `${config.directions ?? ''}\nExtract hint: ${hint}`.trim()
    : (config.directions ?? '');
  const answer = await answerFieldQuestion(
    field,
    context,
    directions,
    config.fieldPrompt ?? DEFAULT_FIELD_PROMPT,
    config.localLlmModel
  );
  return {
    field,
    value: answer.present ? answer.value : null,
    confidence: answer.confidence,
    sourcePages: [],
    fieldQuestion,
  };
}
