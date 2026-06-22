import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { LogEntry, ScrapeProgress, ScrapeRequest } from '../types';
import { processUrl } from './scraper';

class JobManager extends EventEmitter {
  private progress: ScrapeProgress = this.idleProgress();
  private abortController: AbortController | null = null;

  private idleProgress(): ScrapeProgress {
    return {
      jobId: '',
      status: 'idle',
      totalUrls: 0,
      processedUrls: 0,
      currentUrl: null,
      logs: [],
    };
  }

  getProgress(): ScrapeProgress {
    return { ...this.progress, logs: [...this.progress.logs] };
  }

  isRunning(): boolean {
    return this.progress.status === 'running';
  }

  private log(level: LogEntry['level'], message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    this.progress.logs.push(entry);
    this.emit('progress', this.getProgress());
  }

  async start(request: ScrapeRequest): Promise<string> {
    if (this.isRunning()) {
      throw new Error('A scrape job is already running');
    }

    const jobId = uuidv4();
    this.abortController = new AbortController();
    this.progress = {
      jobId,
      status: 'running',
      totalUrls: request.urls.length,
      processedUrls: 0,
      currentUrl: null,
      logs: [],
    };

    this.log('info', `Starting scrape job with ${request.urls.length} URL(s)`);
    this.emit('progress', this.getProgress());

    this.runJob(request, jobId).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.log('error', `Job failed: ${msg}`);
      this.progress.status = 'error';
      this.emit('progress', this.getProgress());
    });

    return jobId;
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.log('warn', 'Stop requested — finishing current URL then halting');
      this.progress.status = 'stopped';
      this.emit('progress', this.getProgress());
    }
  }

  dismissProgress(): void {
    if (!this.isRunning()) {
      this.progress = this.idleProgress();
      this.emit('progress', this.getProgress());
    }
  }

  private async runJob(request: ScrapeRequest, jobId: string): Promise<void> {
    const signal = this.abortController!.signal;

    for (const url of request.urls) {
      if (signal.aborted) {
        this.log('warn', 'Job stopped by user');
        break;
      }

      this.progress.currentUrl = url;
      this.emit('progress', this.getProgress());

      await processUrl(url, request, (level, message) => this.log(level, message), signal);

      this.progress.processedUrls += 1;
      this.emit('progress', this.getProgress());
    }

    if (!signal.aborted) {
      this.progress.status = 'completed';
      this.progress.currentUrl = null;
      this.log('success', 'All URLs processed');
    } else {
      this.progress.status = 'stopped';
      this.progress.currentUrl = null;
    }

    this.emit('progress', this.getProgress());
    this.abortController = null;
  }
}

export const jobManager = new JobManager();
