import cors from 'cors';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { mountCouchProxy } from './couchProxy';
import { mountN8nProxy } from './n8nProxy';
import { databaseRouter } from './routes/database';
import { scrapeRouter } from './routes/scrape';
import { settingsRouter } from './routes/settings';
import { workflowRouter } from './routes/workflow';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(cors());
app.use(express.json());

app.use('/api/scrape', scrapeRouter);
app.use('/api/workflow', workflowRouter);
app.use('/api/database', databaseRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

mountCouchProxy(app);
const n8nProxy = mountN8nProxy(app);

const clientDist = path.join(__dirname, '..', 'public');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = 0;
server.on('upgrade', n8nProxy.upgrade);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Site Scraper server listening on http://0.0.0.0:${PORT}`);
});
