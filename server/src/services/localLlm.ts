import { getSettings } from '../config';

const OLLAMA_BASE = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';

export async function ensureModelAvailable(model: string): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`);
  if (!res.ok) {
    throw new Error(`Ollama not reachable at ${OLLAMA_BASE}`);
  }
  const data = (await res.json()) as { models?: { name: string }[] };
  const names = (data.models ?? []).map((m) => m.name);
  const found = names.some((n) => n === model || n.startsWith(`${model}:`));
  if (!found) {
    await pullModel(model);
  }
}

async function pullModel(model: string): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: false }),
  });
  if (!res.ok) {
    throw new Error(`Failed to pull model ${model}: ${res.statusText}`);
  }
}

export async function generate(prompt: string, model?: string): Promise<string> {
  const settings = getSettings();
  const modelName = model ?? settings.LOCAL_LLM_MODEL;

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 1024 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Local LLM error: ${text}`);
  }

  const data = (await res.json()) as { response?: string };
  return (data.response ?? '').trim();
}

export async function summarizeText(text: string, model?: string): Promise<string> {
  const truncated = text.length > 12000 ? text.slice(0, 12000) + '\n...[truncated]' : text;
  const prompt = `Summarize the following web page text, preserving all factual details like names, dates, numbers, addresses, and product info. Be concise but complete.

TEXT:
${truncated}

SUMMARY:`;
  return generate(prompt, model);
}

export async function answerFieldQuestion(
  field: string,
  context: string,
  directions: string,
  model?: string
): Promise<{ present: boolean; value: string | null; confidence: string }> {
  const prompt = `You are extracting structured data from website content.

General directions: ${directions}

Field to find: "${field}"

Content:
${context}

Answer ONLY with valid JSON in this exact shape:
{"present": true|false, "value": "<extracted value or null>", "confidence": "high"|"medium"|"low"}

JSON:`;

  const raw = await generate(prompt, model);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { present: false, value: null, confidence: 'low' };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      present?: boolean;
      value?: string | null;
      confidence?: string;
    };
    return {
      present: Boolean(parsed.present),
      value: parsed.value ?? null,
      confidence: parsed.confidence ?? 'low',
    };
  } catch {
    return { present: false, value: null, confidence: 'low' };
  }
}
