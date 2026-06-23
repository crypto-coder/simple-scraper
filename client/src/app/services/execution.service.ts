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
}
