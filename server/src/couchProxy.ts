import type { Express } from 'express';
import type { IncomingMessage } from 'http';
import type { ClientRequest } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';

const DATABASE_PATH = '/database';

function isCouchRootPath(pathname: string): boolean {
  if (pathname === '/projects' || pathname.startsWith('/projects/')) return true;
  if (pathname === '/executions' || pathname.startsWith('/executions/')) return true;
  if (pathname === '/scrapes' || pathname.startsWith('/scrapes/')) return true;
  // CouchDB system endpoints (_session, _utils, _uuids, _all_dbs, …)
  if (/^\/_/.test(pathname)) return true;
  return false;
}

function rewriteDatabasePath(path: string): string {
  const rewritten = path.replace(/^\/database\/?/, '/');
  return rewritten.startsWith('/') ? rewritten : `/${rewritten}`;
}

function applyCouchProxyHeaders(proxyReq: ClientRequest, req: IncomingMessage): void {
  const host = req.headers.host;
  if (host) {
    proxyReq.setHeader('Host', host);
    proxyReq.setHeader('X-Forwarded-Host', host);
  }
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  proxyReq.setHeader('X-Forwarded-Proto', String(proto));
  proxyReq.setHeader('X-Forwarded-For', req.socket.remoteAddress ?? '127.0.0.1');
}

function couchProxyOptions(pathFilter: string | ((pathname: string) => boolean), rewrite = false) {
  return {
    target: process.env.COUCHDB_INTERNAL_URL ?? 'http://127.0.0.1:5984',
    changeOrigin: false,
    timeout: 0,
    proxyTimeout: 0,
    pathFilter,
    ...(rewrite ? { pathRewrite: rewriteDatabasePath } : {}),
    on: {
      proxyReq: (proxyReq: ClientRequest, req: IncomingMessage) => {
        applyCouchProxyHeaders(proxyReq, req);
      },
    },
  };
}

export function mountCouchProxy(app: Express): void {
  app.use(createProxyMiddleware(couchProxyOptions(DATABASE_PATH, true)));
  app.use(createProxyMiddleware(couchProxyOptions(isCouchRootPath)));
}
