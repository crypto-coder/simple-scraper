import fs from 'fs';
import path from 'path';
import type { AppSettings } from './types';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

const DEFAULTS: AppSettings = {
  CLOUD_LLM_URL: process.env.CLOUD_LLM_URL ?? '',
  CLOUD_LLM_API_KEY: process.env.CLOUD_LLM_API_KEY ?? '',
  LOCAL_LLM_MODEL: process.env.LOCAL_LLM_MODEL ?? 'gemma4:e4b',
  OLLAMA_MODELS: process.env.OLLAMA_MODELS ?? './models',
  OUTPUT_FOLDER: process.env.OUTPUT_FOLDER ?? './output',
};

function ensureDataDir(): void {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getSettings(): AppSettings {
  ensureDataDir();
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Partial<AppSettings> & {
        MODEL_FOLDER?: string;
      };
      return {
        ...DEFAULTS,
        ...raw,
        OLLAMA_MODELS: raw.OLLAMA_MODELS ?? raw.MODEL_FOLDER ?? DEFAULTS.OLLAMA_MODELS,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: AppSettings): AppSettings {
  ensureDataDir();
  const merged = { ...DEFAULTS, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  applySettingsToEnv(merged);
  return merged;
}

function applySettingsToEnv(settings: AppSettings): void {
  process.env.CLOUD_LLM_URL = settings.CLOUD_LLM_URL;
  process.env.CLOUD_LLM_API_KEY = settings.CLOUD_LLM_API_KEY;
  process.env.LOCAL_LLM_MODEL = settings.LOCAL_LLM_MODEL;
  process.env.OLLAMA_MODELS = settings.OLLAMA_MODELS;
  process.env.OUTPUT_FOLDER = settings.OUTPUT_FOLDER;
}

applySettingsToEnv(getSettings());
