import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { LogEntry, ScrapeProgress, ScrapeRequest } from '../types';
import { projectFromScrapeRequest, triggerScrapeWorkflow } from './n8nTrigger';
import { createWorkflowExecution } from './workflowCouch';

export type ProgressEventType = 'log' | 'url_start' | 'url_done' | 'complete' | 'error';

class JobManager extends EventEmitter {
  private progress: ScrapeProgress = this.idleProgress();

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

  private assertJob(jobId: string): boolean {
    return this.progress.jobId === jobId;
  }

  async start(request: ScrapeRequest): Promise<string> {
    if (this.isRunning()) {
      throw new Error('A scrape job is already running');
    }

    const jobId = uuidv4();
    const project = projectFromScrapeRequest(request);
    const execution = await createWorkflowExecution(project);

    this.progress = {
      jobId,
      status: 'running',
      totalUrls: project.website_urls.length,
      processedUrls: 0,
      currentUrl: null,
      logs: [],
    };

    this.log('info', `Starting scrape job with ${project.website_urls.length} URL(s) via n8n`);
    this.log('info', `Execution ${execution.execution_id} created in CouchDB`);
    this.emit('progress', this.getProgress());

    try {
      await triggerScrapeWorkflow(jobId, request, execution.execution_id, project);
      this.log('info', 'n8n workflow triggered');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log('error', `Failed to trigger n8n workflow: ${msg}`);
      this.progress.status = 'error';
      this.emit('progress', this.getProgress());
      throw err;
    }

    return jobId;
  }

  handleProgressEvent(
    jobId: string,
    type: ProgressEventType,
    payload: { level?: LogEntry['level']; message?: string; url?: string }
  ): void {
    if (!this.assertJob(jobId)) return;

    switch (type) {
      case 'log':
        this.log(payload.level ?? 'info', payload.message ?? '');
        break;
      case 'url_start':
        if (payload.url) {
          this.progress.currentUrl = payload.url;
          this.log('info', payload.message ?? `Starting spider for ${payload.url}`);
        }
        break;
      case 'url_done':
        if (this.progress.status === 'stopped') break;
        this.progress.processedUrls += 1;
        if (payload.message) {
          this.log('success', payload.message);
        }
        if (this.progress.processedUrls >= this.progress.totalUrls) {
          this.finishJob('completed', 'All URLs processed');
        } else {
          this.emit('progress', this.getProgress());
        }
        break;
      case 'complete':
        this.finishJob('completed', payload.message ?? 'All URLs processed');
        break;
      case 'error':
        this.log('error', payload.message ?? 'Workflow error');
        this.progress.status = 'error';
        this.progress.currentUrl = null;
        this.emit('progress', this.getProgress());
        break;
    }
  }

  private finishJob(status: 'completed' | 'stopped', message: string): void {
    this.progress.status = status;
    this.progress.currentUrl = null;
    this.log('success', message);
    this.emit('progress', this.getProgress());
  }

  stop(): void {
    if (!this.isRunning()) return;
    this.log('warn', 'Stop requested — n8n workflow may continue current step');
    this.progress.status = 'stopped';
    this.emit('progress', this.getProgress());
  }

  dismissProgress(): void {
    if (!this.isRunning()) {
      this.progress = this.idleProgress();
      this.emit('progress', this.getProgress());
    }
  }
}

export const jobManager = new JobManager();
