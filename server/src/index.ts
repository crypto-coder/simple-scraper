import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { mountN8nProxy } from './n8nProxy';
import { scrapeRouter } from './routes/scrape';
import { settingsRouter } from './routes/settings';
import { workflowRouter } from './routes/workflow';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(cors());
app.use(express.json());

app.use('/api/scrape', scrapeRouter);
app.use('/api/workflow', workflowRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

mountN8nProxy(app);

const clientDist = path.join(__dirname, '..', 'public');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Site Scraper server listening on http://0.0.0.0:${PORT}`);
});
