import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import type { LlmOption, PromptDefaults, ScrapeProgress, ScrapeRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class ScrapeService {
  private base = '/api/scrape';
  private progressSubject = new BehaviorSubject<ScrapeProgress | null>(null);
  private eventSource: EventSource | null = null;

  progress$ = this.progressSubject.asObservable();

  constructor(
    private http: HttpClient,
    private zone: NgZone
  ) {}

  getModels(): Observable<LlmOption[]> {
    return this.http.get<LlmOption[]>(`${this.base}/models`);
  }

  getPromptDefaults(): Observable<PromptDefaults> {
    return this.http.get<PromptDefaults>(`${this.base}/prompt-defaults`);
  }

  startStream(): void {
    if (this.eventSource) return;

    this.eventSource = new EventSource(`${this.base}/progress/stream`);
    this.eventSource.onmessage = (event) => {
      this.zone.run(() => {
        const data = JSON.parse(event.data) as ScrapeProgress;
        this.progressSubject.next(data);
      });
    };
    this.eventSource.onerror = () => {
      this.stopStream();
      setTimeout(() => this.startStream(), 3000);
    };
  }

  stopStream(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  startScrape(request: ScrapeRequest): Observable<{ jobId: string }> {
    return this.http.post<{ jobId: string }>(`${this.base}/start`, request);
  }

  stopScrape(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/stop`, {});
  }

  dismissProgress(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/dismiss`, {});
  }
}
