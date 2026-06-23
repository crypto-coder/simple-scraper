import { Router } from 'express';
import { getDocument, listDocuments } from '../services/couchClient';
import { deleteExecutionWithScrapes } from '../services/workflowCouch';
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

executionsRouter.delete('/:id', async (req, res) => {
  try {
    await deleteExecutionWithScrapes(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(502).json({ error: msg });
  }
});

function stripCouchMeta(doc: CouchDoc<Execution>): Execution {
  const { _id, _rev, ...execution } = doc;
  return {
    ...execution,
    scrapes: execution.scrapes ?? [],
  };
}
