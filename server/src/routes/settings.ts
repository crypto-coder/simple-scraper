import { Router } from 'express';
import { getSettings, saveSettings } from '../config';
import type { AppSettings } from '../types';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json(getSettings());
});

settingsRouter.put('/', (req, res) => {
  const body = req.body as Partial<AppSettings>;
  const current = getSettings();
  const updated = saveSettings({
    CLOUD_LLM_URL: body.CLOUD_LLM_URL ?? current.CLOUD_LLM_URL,
    CLOUD_LLM_API_KEY: body.CLOUD_LLM_API_KEY ?? current.CLOUD_LLM_API_KEY,
    LOCAL_LLM_MODEL: body.LOCAL_LLM_MODEL ?? current.LOCAL_LLM_MODEL,
    OLLAMA_MODELS: body.OLLAMA_MODELS ?? current.OLLAMA_MODELS,
    OUTPUT_FOLDER: body.OUTPUT_FOLDER ?? current.OUTPUT_FOLDER,
  });
  res.json(updated);
});
