import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Project } from '../models';

type ProjectInput = Omit<Project, 'project_id'> & { project_id?: string };

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private http: HttpClient) {}

  list(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/projects');
  }

  create(project: ProjectInput): Observable<Project> {
    return this.http.post<Project>('/api/projects', project);
  }

  update(project: Project): Observable<Project> {
    return this.http.put<Project>(`/api/projects/${encodeURIComponent(project.project_id)}`, project);
  }
}
