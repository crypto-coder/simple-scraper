import { HttpClient } from '@angular/common/http';
import { Component, inject, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-database-tab',
  standalone: true,
  templateUrl: './database-tab.component.html',
  styleUrl: './database-tab.component.css',
})
export class DatabaseTabComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() active = false;

  databaseUrl: SafeResourceUrl | null = null;
  loading = false;
  error = '';
  private sessionStarted = false;

  ngOnChanges(): void {
    if (this.active) {
      this.ensureSession();
    }
  }

  private ensureSession(): void {
    if (this.sessionStarted || this.databaseUrl) return;
    this.sessionStarted = true;
    this.loading = true;
    this.error = '';

    this.http.post<{ ok: boolean }>('/api/database/couch-login', {}, { withCredentials: true }).subscribe({
      next: () => {
        this.databaseUrl = this.sanitizer.bypassSecurityTrustResourceUrl('/database/_utils/');
        this.loading = false;
      },
      error: (err) => {
        this.error =
          err?.error?.error ??
          'Could not sign in to CouchDB. Check COUCHDB_* settings and restart the stack.';
        this.loading = false;
        this.sessionStarted = false;
      },
    });
  }
}
