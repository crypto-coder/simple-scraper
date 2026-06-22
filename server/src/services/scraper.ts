import fs from 'fs';
import path from 'path';
import { getSettings, resolvePath } from '../config';
import type { FieldResult, ScrapeRequest, UrlScrapeResult } from '../types';
import { formatOutputWithCloudLlm } from './cloudLlm';
import { answerFieldQuestion, ensureModelAvailable, summarizeText } from './localLlm';
import { cleanupTempDir, getOutputDir, spiderWebsite } from './spider';

export type LogFn = (level: 'info' | 'error' | 'warn' | 'success', message: string) => void;

export async function processUrl(
  url: string,
  request: ScrapeRequest,
  log: LogFn,
  abortSignal: AbortSignal
): Promise<UrlScrapeResult> {
  const settings = getSettings();
  const tempDir = path.join(resolvePath('./data/temp'), Buffer.from(url).toString('base64url').slice(0, 24));

  if (abortSignal.aborted) {
    return { url, fields: [], pagesScraped: 0, skipped: true, skipReason: 'Stopped by user' };
  }

  log('info', `Starting spider for ${url}`);

  let pages;
  try {
    pages = await spiderWebsite(url, tempDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('error', `Failed to spider ${url}: ${msg}`);
    cleanupTempDir(tempDir);
    return { url, fields: [], pagesScraped: 0, skipped: true, skipReason: msg };
  }

  if (pages.length === 0) {
    log('warn', `Skipped ${url}: no pages could be scraped`);
    cleanupTempDir(tempDir);
    return { url, fields: [], pagesScraped: 0, skipped: true, skipReason: 'No pages scraped' };
  }

  log('success', `Spidered ${pages.length} page(s) at ${url}`);

  try {
    await ensureModelAvailable(request.localLlmModel || settings.LOCAL_LLM_MODEL);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('error', `Local LLM unavailable: ${msg}`);
    cleanupTempDir(tempDir);
    return { url, fields: [], pagesScraped: pages.length, skipped: true, skipReason: msg };
  }

  const combinedText = pages.map((p) => p.text).join('\n\n');
  let context = combinedText;

  if (combinedText.length > 8000) {
    log('info', `Summarizing extracted text for ${url} (${combinedText.length} chars)`);
    try {
      context = await summarizeText(
        combinedText,
        request.summarizePrompt,
        request.localLlmModel
      );
      log('success', `Summarized text to ${context.length} chars`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('warn', `Summarization failed, using truncated text: ${msg}`);
      context = combinedText.slice(0, 8000);
    }
  }

  const fields: FieldResult[] = [];

  for (const field of request.fields) {
    if (abortSignal.aborted) break;

    log('info', `Checking field "${field}" for ${url}`);
    try {
      const answer = await answerFieldQuestion(
        field,
        context,
        request.prompt,
        request.fieldPrompt,
        request.localLlmModel
      );

      const sourcePages = pages
        .filter((p) => p.text.toLowerCase().includes((answer.value ?? '').toLowerCase().slice(0, 20)))
        .map((p) => p.url);

      fields.push({
        field,
        value: answer.present ? answer.value : null,
        confidence: answer.confidence,
        sourcePages: sourcePages.length > 0 ? sourcePages : pages.slice(0, 1).map((p) => p.url),
      });

      if (answer.present) {
        log('success', `Found "${field}": ${answer.value}`);
      } else {
        log('warn', `Field "${field}" not found on ${url}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', `Error extracting "${field}": ${msg}`);
      fields.push({ field, value: null, confidence: 'low', sourcePages: [] });
    }
  }

  log('info', `Formatting output for ${url}`);
  let outputDoc: Record<string, unknown>;
  try {
    outputDoc = await formatOutputWithCloudLlm(url, fields, request.prompt, pages.length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `Cloud LLM formatting failed, using local format: ${msg}`);
    outputDoc = { url, pagesScraped: pages.length, fields: Object.fromEntries(fields.map((f) => [f.field, f.value])) };
  }

  const outputDir = getOutputDir();
  const slug = new URL(url).hostname.replace(/\./g, '_') + '_' + Date.now();
  const outPath = path.join(outputDir, `${slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(outputDoc, null, 2), 'utf-8');
  log('success', `Saved output to ${outPath}`);

  cleanupTempDir(tempDir);

  return { url, fields, pagesScraped: pages.length, skipped: false };
}
