import { Router } from 'express';
import { deleteDocument, getDocument, listDocuments, putDocument } from '../services/couchClient';
import type { CouchDoc, Execution } from '../types/records';

export const executionsRouter = Router();

executionsRouter.get('/', async (_req, res) => {
  try {
    const docs = await listDocuments<CouchDoc<Execution>>('executions');
    const executions = docs
      .map(stripCouchMeta)
      .sort((a, b) => b.execution_time.localeCompare(a.execution_time));
    res.json(executions);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

executionsRouter.get('/:id', async (req, res) => {
  try {
    const doc = await getDocument<CouchDoc<Execution>>('executions', req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }
    res.json(stripCouchMeta(doc));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

executionsRouter.put('/:id', async (req, res) => {
  try {
    const body = req.body as Execution;
    if (!body.execution_id || body.execution_id !== req.params.id) {
      res.status(400).json({ error: 'execution_id must match URL id' });
      return;
    }

    const existing = await getDocument<CouchDoc<Execution>>('executions', req.params.id);
    const saved = await putDocument('executions', req.params.id, {
      ...body,
      _rev: existing?._rev,
    });
    res.json({ ...body, _rev: saved.rev });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

executionsRouter.delete('/:id', async (req, res) => {
  try {
    const existing = await getDocument<CouchDoc<Execution>>('executions', req.params.id);
    if (!existing?._rev) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }
    await deleteDocument('executions', req.params.id, existing._rev);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

function stripCouchMeta(doc: CouchDoc<Execution>): Execution {
  const { _id, _rev, ...execution } = doc;
  return execution;
}
