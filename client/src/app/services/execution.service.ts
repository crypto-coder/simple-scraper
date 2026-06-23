import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Execution } from '../models';

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  constructor(private http: HttpClient) {}

  list(): Observable<Execution[]> {
    return this.http.get<Execution[]>('/api/executions');
  }

  get(id: string): Observable<Execution> {
    return this.http.get<Execution>(`/api/executions/${encodeURIComponent(id)}`);
  }

  delete(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/executions/${encodeURIComponent(id)}`);
  }
}
