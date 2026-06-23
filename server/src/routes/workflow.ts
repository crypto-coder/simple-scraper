import { Router } from 'express';
import { jobManager, type ProgressEventType } from '../services/jobManager';
import { loginToN8n } from '../services/n8nAuth';
import {
  workflowExtractField,
  workflowScrapePage,
  workflowSpider,
  workflowSummarize,
} from '../services/workflowEngine';
import { appendExecutionResults, saveScrapeRecord, updateScrapeSummarizedText } from '../services/workflowCouch';
import type { Result } from '../types/records';

export const workflowRouter = Router();

workflowRouter.post('/n8n-login', async (_req, res) => {
  try {
    const cookies = await loginToN8n();
    for (const cookie of cookies) {
      res.append('Set-Cookie', cookie);
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

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
    const { url, execution_id } = req.body as { url?: string; execution_id?: string };
    if (!url?.trim()) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    const result = await workflowScrapePage(url.trim());

    if (execution_id?.trim()) {
      const scrape = await saveScrapeRecord({
        execution_id: execution_id.trim(),
        page_url: url.trim(),
        scraped_text: result.text,
        summarized_text: '',
      });
      res.json({ ...result, scrape_id: scrape.scrape_id, scrape_date: scrape.scrape_date });
      return;
    }

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

workflowRouter.post('/summarize', async (req, res) => {
  try {
    const { text, scrape_id, directions, summarizePrompt, fieldPrompt, localLlmModel } = req.body as {
      text?: string;
      scrape_id?: string;
      directions?: string;
      summarizePrompt?: string;
      fieldPrompt?: string;
      localLlmModel?: string;
    };
    if (!text?.trim()) {
      const empty = { summary: '', summaryLength: 0 };
      if (scrape_id?.trim()) {
        await updateScrapeSummarizedText(scrape_id.trim(), '');
      }
      res.json(empty);
      return;
    }
    const result = await workflowSummarize(text, {
      directions,
      summarizePrompt,
      fieldPrompt,
      localLlmModel,
    });

    if (scrape_id?.trim()) {
      await updateScrapeSummarizedText(scrape_id.trim(), result.summary);
    }

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

workflowRouter.post('/extract-field', async (req, res) => {
  try {
    const { field, context, directions, summarizePrompt, fieldPrompt, localLlmModel, extractHint } =
      req.body as {
        field?: string;
        context?: string;
        directions?: string;
        summarizePrompt?: string;
        fieldPrompt?: string;
        localLlmModel?: string;
        extractHint?: string;
      };
    if (!field?.trim()) {
      res.status(400).json({ error: 'field is required' });
      return;
    }
    const result = await workflowExtractField(field.trim(), context ?? '', {
      directions,
      summarizePrompt,
      fieldPrompt,
      localLlmModel,
      extractHint,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

workflowRouter.post('/save-execution', async (req, res) => {
  try {
    const { execution_id, results, startUrl } = req.body as {
      execution_id?: string;
      results?: Result[];
      startUrl?: string;
    };
    if (!execution_id?.trim()) {
      res.status(400).json({ error: 'execution_id is required' });
      return;
    }
    const saved = await appendExecutionResults(execution_id.trim(), results ?? []);
    res.json({ ...saved, startUrl: startUrl ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
