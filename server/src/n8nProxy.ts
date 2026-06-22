import type { Express } from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';

const N8N_PATH = '/workflow';

function stripN8nTelemetry(html: string): string {
  return html
    .replace(/<script[^>]*posthog\.init\.js[^>]*>\s*<\/script>\s*/gi, '')
    .replace(/<meta name="n8n:config:sentry"[^>]*>\s*/gi, '');
}

export function mountN8nProxy(app: Express): void {
  const target = process.env.N8N_INTERNAL_URL ?? 'http://127.0.0.1:5678';

  app.use(
    N8N_PATH,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      selfHandleResponse: true,
      on: {
        proxyReq: (proxyReq, req) => {
          const host = req.headers.host;
          if (host) {
            proxyReq.setHeader('X-Forwarded-Host', host);
          }
          proxyReq.setHeader('X-Forwarded-Proto', 'http');
          proxyReq.setHeader('X-Forwarded-For', req.socket.remoteAddress ?? '127.0.0.1');
        },
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
          const contentType = proxyRes.headers['content-type'] ?? '';
          if (contentType.includes('text/html')) {
            return stripN8nTelemetry(responseBuffer.toString('utf8'));
          }
          return responseBuffer;
        }),
      },
    })
  );
}

export const N8N_WORKFLOW_URL = `${N8N_PATH}/`;
