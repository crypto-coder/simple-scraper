import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AppSettings } from '../models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private base = '/api/settings';

  constructor(private http: HttpClient) {}

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(this.base);
  }

  saveSettings(settings: AppSettings): Observable<AppSettings> {
    return this.http.put<AppSettings>(this.base, settings);
  }
}
