import type { Express } from 'express';
import type { IncomingMessage } from 'http';
import type { ClientRequest } from 'http';
import type { RequestHandler } from 'http-proxy-middleware';
import { createProxyMiddleware } from 'http-proxy-middleware';

const N8N_PATH = '/workflow';

function rewriteN8nPath(path: string): string {
  const rewritten = path.replace(/^\/workflow\/?/, '/');
  return rewritten.startsWith('/') ? rewritten : `/${rewritten}`;
}

function applyN8nProxyHeaders(proxyReq: ClientRequest, req: IncomingMessage): void {
  const host = req.headers.host;
  if (host) {
    // n8n validates Origin against Host / X-Forwarded-Host — keep the browser host.
    proxyReq.setHeader('Host', host);
    proxyReq.setHeader('X-Forwarded-Host', host);
  }
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  proxyReq.setHeader('X-Forwarded-Proto', String(proto));
  proxyReq.setHeader('X-Forwarded-For', req.socket.remoteAddress ?? '127.0.0.1');
}

export function mountN8nProxy(app: Express): RequestHandler {
  const target = process.env.N8N_INTERNAL_URL ?? 'http://127.0.0.1:5678';

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: false,
    ws: true,
    // Stream responses through — do not buffer (required for /rest/push and slow saves).
    pathFilter: N8N_PATH,
    pathRewrite: rewriteN8nPath,
    timeout: 0,
    proxyTimeout: 0,
    on: {
      proxyReq: (proxyReq, req) => {
        applyN8nProxyHeaders(proxyReq, req);
      },
      proxyReqWs: (proxyReq, req) => {
        applyN8nProxyHeaders(proxyReq, req);
      },
    },
  });

  app.use(proxy);
  return proxy;
}

export const N8N_WORKFLOW_URL = `${N8N_PATH}/`;
