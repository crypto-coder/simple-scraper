import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Execution, Scrape } from '../models';

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  constructor(private http: HttpClient) {}

  list(): Observable<Execution[]> {
    return this.http.get<Execution[]>('/api/executions');
  }

  get(id: string): Observable<Execution> {
    return this.http.get<Execution>(`/api/executions/${encodeURIComponent(id)}`);
  }

  save(execution: Execution): Observable<Execution> {
    return this.http.put<Execution>(
      `/api/executions/${encodeURIComponent(execution.execution_id)}`,
      execution
    );
  }

  listScrapes(executionId?: string): Observable<Scrape[]> {
    const params = executionId ? { execution_id: executionId } : undefined;
    return this.http.get<Scrape[]>('/api/scrapes', { params });
  }
}
