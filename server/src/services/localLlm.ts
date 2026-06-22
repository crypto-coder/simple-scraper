import { getSettings } from '../config';
import {
  DEFAULT_FIELD_PROMPT,
  DEFAULT_SUMMARIZE_PROMPT,
  fieldToQuestion,
  parseFieldAnswer,
  renderPromptTemplate,
} from '../prompts';

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

export async function summarizeText(
  text: string,
  template: string = DEFAULT_SUMMARIZE_PROMPT,
  model?: string
): Promise<string> {
  const truncated = text.length > 30000 ? text.slice(0, 30000) + '\n...[truncated]' : text;
  const prompt = renderPromptTemplate(template, { text: truncated });
  return generate(prompt, model);
}

export async function answerFieldQuestion(
  field: string,
  context: string,
  directions: string,
  template: string = DEFAULT_FIELD_PROMPT,
  model?: string
): Promise<{ present: boolean; value: string | null; confidence: string }> {
  const fieldQuestion = fieldToQuestion(field);
  const prompt = renderPromptTemplate(template, {
    field,
    fieldQuestion,
    directions,
    context,
  });

  const raw = await generate(prompt, model);
  return parseFieldAnswer(raw);
}
