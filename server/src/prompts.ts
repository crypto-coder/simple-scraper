export const DEFAULT_SUMMARIZE_PROMPT = `Summarize the following web page text. Preserve all factual details: names, dates, numbers, addresses, emails, phone numbers, and product info. Be concise but complete.

TEXT:
{{text}}

SUMMARY:`;

export const DEFAULT_FIELD_PROMPT = `You are answering questions using ONLY the web page content provided below.

Scraping directions: {{directions}}

Question: {{fieldQuestion}}

Rules:
- Answer with ONLY the value found in the content — no explanation
- If the value is not present, answer exactly: NOT FOUND
- Do not guess or invent information

Content:
{{context}}

Answer:`;

export function fieldToQuestion(field: string): string {
  const label = field.replace(/[_-]+/g, ' ').trim();
  return `What is the ${label}?`;
}

export function renderPromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

export function parseFieldAnswer(raw: string): {
  present: boolean;
  value: string | null;
  confidence: string;
} {
  const trimmed = raw.trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        present?: boolean;
        value?: string | null;
        confidence?: string;
      };
      return {
        present: Boolean(parsed.present),
        value: parsed.value ?? null,
        confidence: parsed.confidence ?? (parsed.present ? 'medium' : 'low'),
      };
    } catch {
      // fall through to plain-text parsing
    }
  }

  const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
  if (!firstLine || /^(not found|n\/a|none|unknown|not available)$/i.test(firstLine)) {
    return { present: false, value: null, confidence: 'high' };
  }

  return { present: true, value: firstLine, confidence: 'medium' };
}
