import { Router } from 'express';
import { listDocuments } from '../services/couchClient';
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

function stripCouchMeta(doc: CouchDoc<Execution>): Execution {
  const { _id, _rev, ...execution } = doc;
  return execution;
}
