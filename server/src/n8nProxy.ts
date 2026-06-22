import type { Express } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const N8N_PATH = '/workflow';

export function mountN8nProxy(app: Express): void {
  const target = process.env.N8N_INTERNAL_URL ?? 'http://127.0.0.1:5678';

  app.use(
    N8N_PATH,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
    })
  );
}

export const N8N_WORKFLOW_URL = `${N8N_PATH}/`;
