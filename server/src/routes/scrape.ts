import { Router } from 'express';
import { jobManager } from '../services/jobManager';
import { DEFAULT_FIELD_PROMPT, DEFAULT_SUMMARIZE_PROMPT } from '../prompts';
import { LOCAL_LLM_OPTIONS, type ScrapeRequest } from '../types';
import { projectFromScrapeRequest } from '../services/n8nTrigger';

export const scrapeRouter = Router();

scrapeRouter.get('/models', (_req, res) => {
  res.json([...LOCAL_LLM_OPTIONS]);
});

scrapeRouter.get('/prompt-defaults', (_req, res) => {
  res.json({
    summarizePrompt: DEFAULT_SUMMARIZE_PROMPT,
    fieldPrompt: DEFAULT_FIELD_PROMPT,
  });
});

scrapeRouter.get('/progress', (_req, res) => {
  res.json(jobManager.getProgress());
});

scrapeRouter.get('/progress/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = () => {
    res.write(`data: ${JSON.stringify(jobManager.getProgress())}\n\n`);
  };

  send();
  jobManager.on('progress', send);

  req.on('close', () => {
    jobManager.off('progress', send);
  });
});

scrapeRouter.post('/start', async (req, res) => {
  try {
    const body = req.body as ScrapeRequest;
    const project = body.project ? body.project : projectFromScrapeRequest(body);

    if (!project.website_urls?.length) {
      res.status(400).json({ error: 'At least one URL is required' });
      return;
    }
    if (!project.output_fields?.length) {
      res.status(400).json({ error: 'At least one output field is required' });
      return;
    }

    const jobId = await jobManager.start({
      project,
      urls: project.website_urls,
      fields: project.output_fields.map((f) => f.field_name),
      prompt: project.main_prompt,
      summarizePrompt: project.summarize_prompt ?? DEFAULT_SUMMARIZE_PROMPT,
      fieldPrompt: project.field_extract_prompt ?? DEFAULT_FIELD_PROMPT,
      localLlmModel: project.local_llm ?? 'gemma4:e4b',
    });

    res.json({ jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(409).json({ error: msg });
  }
});

scrapeRouter.post('/stop', (_req, res) => {
  jobManager.stop();
  res.json({ ok: true });
});

scrapeRouter.post('/dismiss', (_req, res) => {
  jobManager.dismissProgress();
  res.json({ ok: true });
});
