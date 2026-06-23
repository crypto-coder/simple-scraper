import { Router } from 'express';
import { loginToCouch } from '../services/couchAuth';

export const databaseRouter = Router();

databaseRouter.post('/couch-login', async (_req, res) => {
  try {
    const cookies = await loginToCouch();
    for (const cookie of cookies) {
      res.append('Set-Cookie', cookie);
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});
