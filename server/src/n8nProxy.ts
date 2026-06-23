import type { Express } from 'express';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import type { Duplex } from 'stream';
import type { ClientRequest } from 'http';
import type { RequestHandler } from 'http-proxy-middleware';
import { createProxyMiddleware } from 'http-proxy-middleware';

export const N8N_PATH = '/workflow';

/** Headers from n8n that break embedded HTTP / iframe use on LAN IPs. */
const STRIPPED_RESPONSE_HEADERS = [
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster',
];

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
  proxyReq.setHeader('X-Forwarded-Prefix', N8N_PATH);
}

function stripProblematicHeaders(proxyRes: IncomingMessage): void {
  for (const header of STRIPPED_RESPONSE_HEADERS) {
    proxyRes.headers[header] = undefined;
  }
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
      proxyRes: (proxyRes) => {
        stripProblematicHeaders(proxyRes);
      },
    },
  });

  app.use(proxy);
  return proxy;
}

/** Handle WebSocket upgrades for n8n push (/workflow/rest/push). */
export function handleN8nUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  proxy: RequestHandler
): void {
  const pathname = req.url?.split('?')[0] ?? '';
  if (!pathname.startsWith(N8N_PATH)) {
    socket.destroy();
    return;
  }

  if (typeof proxy.upgrade !== 'function') {
    socket.destroy();
    return;
  }

  proxy.upgrade(req, socket as Socket, head);
}

export const N8N_WORKFLOW_URL = `${N8N_PATH}/`;
