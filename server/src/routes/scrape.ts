import { Router } from 'express';
import { jobManager } from '../services/jobManager';
import { LOCAL_LLM_OPTIONS, type ScrapeRequest } from '../types';

export const scrapeRouter = Router();

scrapeRouter.get('/models', (_req, res) => {
  res.json(LOCAL_LLM_OPTIONS);
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
    if (!body.urls?.length) {
      res.status(400).json({ error: 'At least one URL is required' });
      return;
    }
    if (!body.fields?.length) {
      res.status(400).json({ error: 'At least one output field is required' });
      return;
    }

    const jobId = await jobManager.start({
      urls: body.urls.map((u) => u.trim()).filter(Boolean),
      fields: body.fields.map((f) => f.trim()).filter(Boolean),
      prompt: body.prompt ?? '',
      localLlmModel: body.localLlmModel ?? 'gemma4:e4b',
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
