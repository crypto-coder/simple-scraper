import { getSettings } from '../config';
import type { FieldResult, UrlScrapeResult } from '../types';

export async function formatOutputWithCloudLlm(
  url: string,
  fields: FieldResult[],
  prompt: string,
  pagesScraped: number
): Promise<Record<string, unknown>> {
  const settings = getSettings();
  if (!settings.CLOUD_LLM_URL) {
    return buildFallbackOutput(url, fields, pagesScraped);
  }

  const systemPrompt = `You are a data extraction formatter. Given scraped field results from a website, produce a clean, well-structured JSON object.
Follow the user's general directions for formatting and output structure.`;

  const userPrompt = `URL: ${url}
Pages scraped: ${pagesScraped}
General directions: ${prompt}

Extracted fields:
${JSON.stringify(fields, null, 2)}

Return ONLY valid JSON representing the final output document for this URL.`;

  try {
    const res = await fetch(normalizeChatUrl(settings.CLOUD_LLM_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.CLOUD_LLM_API_KEY
          ? { Authorization: `Bearer ${settings.CLOUD_LLM_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloud LLM error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    }
    return buildFallbackOutput(url, fields, pagesScraped);
  } catch {
    return buildFallbackOutput(url, fields, pagesScraped);
  }
}

function normalizeChatUrl(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function buildFallbackOutput(
  url: string,
  fields: FieldResult[],
  pagesScraped: number
): Record<string, unknown> {
  const output: Record<string, unknown> = { url, pagesScraped };
  for (const f of fields) {
    output[f.field] = f.value;
  }
  return output;
}

export function mergeResults(results: UrlScrapeResult[]): Record<string, unknown>[] {
  return results.map((r) => ({
    url: r.url,
    pagesScraped: r.pagesScraped,
    skipped: r.skipped,
    skipReason: r.skipReason,
    fields: Object.fromEntries(r.fields.map((f) => [f.field, f.value])),
  }));
}
