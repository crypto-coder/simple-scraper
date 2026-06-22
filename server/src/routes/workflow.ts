import { Router } from 'express';
import { jobManager, type ProgressEventType } from '../services/jobManager';
import {
  workflowExtractField,
  workflowSaveResult,
  workflowScrapePage,
  workflowSpider,
  workflowSummarize,
  type PageWorkflowResult,
} from '../services/workflowEngine';

export const workflowRouter = Router();

workflowRouter.post('/progress/:jobId/event', (req, res) => {
  const { jobId } = req.params;
  const { type, level, message, url } = req.body as {
    type?: ProgressEventType;
    level?: 'info' | 'error' | 'warn' | 'success';
    message?: string;
    url?: string;
  };

  if (!type) {
    res.status(400).json({ error: 'type is required' });
    return;
  }

  jobManager.handleProgressEvent(jobId, type, { level, message, url });
  res.json({ ok: true });
});

workflowRouter.post('/spider', async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url?.trim()) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    const result = await workflowSpider(url.trim());
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

workflowRouter.post('/scrape-page', async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url?.trim()) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    const result = await workflowScrapePage(url.trim());
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

workflowRouter.post('/summarize', async (req, res) => {
  try {
    const { text, directions, summarizePrompt, fieldPrompt, localLlmModel } = req.body as {
      text?: string;
      directions?: string;
      summarizePrompt?: string;
      fieldPrompt?: string;
      localLlmModel?: string;
    };
    if (!text?.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const result = await workflowSummarize(text, {
      directions,
      summarizePrompt,
      fieldPrompt,
      localLlmModel,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

workflowRouter.post('/extract-field', async (req, res) => {
  try {
    const { field, context, directions, summarizePrompt, fieldPrompt, localLlmModel } =
      req.body as {
        field?: string;
        context?: string;
        directions?: string;
        summarizePrompt?: string;
        fieldPrompt?: string;
        localLlmModel?: string;
      };
    if (!field?.trim()) {
      res.status(400).json({ error: 'field is required' });
      return;
    }
    if (!context?.trim()) {
      res.status(400).json({ error: 'context is required' });
      return;
    }
    const result = await workflowExtractField(field.trim(), context, {
      directions,
      summarizePrompt,
      fieldPrompt,
      localLlmModel,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

workflowRouter.post('/save-result', async (req, res) => {
  try {
    const { startUrl, pageResults, directions, summarizePrompt, fieldPrompt, localLlmModel } =
      req.body as {
        startUrl?: string;
        pageResults?: PageWorkflowResult[];
        directions?: string;
        summarizePrompt?: string;
        fieldPrompt?: string;
        localLlmModel?: string;
      };
    if (!startUrl?.trim()) {
      res.status(400).json({ error: 'startUrl is required' });
      return;
    }
    if (!pageResults?.length) {
      res.status(400).json({ error: 'pageResults is required' });
      return;
    }
    const result = await workflowSaveResult(startUrl.trim(), pageResults, {
      directions,
      summarizePrompt,
      fieldPrompt,
      localLlmModel,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
