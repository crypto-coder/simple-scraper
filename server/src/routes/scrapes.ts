import { Router } from 'express';
import { deleteDocument, getDocument, listDocuments, putDocument } from '../services/couchClient';
import type { CouchDoc, Scrape } from '../types/records';

export const scrapesRouter = Router();

scrapesRouter.get('/', async (req, res) => {
  try {
    const executionId = typeof req.query.execution_id === 'string' ? req.query.execution_id : undefined;
    const docs = await listDocuments<CouchDoc<Scrape>>('scrapes');
    let scrapes = docs.map(stripCouchMeta);
    if (executionId) {
      scrapes = scrapes.filter((s) => s.execution_id === executionId);
    }
    scrapes.sort((a, b) => b.scrape_date.localeCompare(a.scrape_date));
    res.json(scrapes);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

scrapesRouter.get('/:id', async (req, res) => {
  try {
    const doc = await getDocument<CouchDoc<Scrape>>('scrapes', req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Scrape not found' });
      return;
    }
    res.json(stripCouchMeta(doc));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

scrapesRouter.put('/:id', async (req, res) => {
  try {
    const body = req.body as Scrape;
    if (!body.scrape_id || body.scrape_id !== req.params.id) {
      res.status(400).json({ error: 'scrape_id must match URL id' });
      return;
    }

    const existing = await getDocument<CouchDoc<Scrape>>('scrapes', req.params.id);
    const saved = await putDocument('scrapes', req.params.id, {
      ...body,
      _rev: existing?._rev,
    });
    res.json({ ...body, _rev: saved.rev });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

scrapesRouter.delete('/:id', async (req, res) => {
  try {
    const existing = await getDocument<CouchDoc<Scrape>>('scrapes', req.params.id);
    if (!existing?._rev) {
      res.status(404).json({ error: 'Scrape not found' });
      return;
    }
    await deleteDocument('scrapes', req.params.id, existing._rev);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

function stripCouchMeta(doc: CouchDoc<Scrape>): Scrape {
  const { _id, _rev, ...scrape } = doc;
  return scrape;
}
