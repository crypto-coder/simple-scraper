import { HttpClient } from '@angular/common/http';
import { Component, inject, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-workflow-tab',
  standalone: true,
  templateUrl: './workflow-tab.component.html',
  styleUrl: './workflow-tab.component.css',
})
export class WorkflowTabComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() active = false;

  workflowUrl: SafeResourceUrl | null = null;
  loading = false;
  error = '';
  private sessionStarted = false;

  ngOnChanges(): void {
    if (this.active) {
      this.ensureSession();
    }
  }

  private ensureSession(): void {
    if (this.sessionStarted || this.workflowUrl) return;
    this.sessionStarted = true;
    this.loading = true;
    this.error = '';

    this.http.post<{ ok: boolean }>('/api/workflow/n8n-login', {}, { withCredentials: true }).subscribe({
      next: () => {
        this.workflowUrl = this.sanitizer.bypassSecurityTrustResourceUrl('/workflow/');
        this.loading = false;
      },
      error: (err) => {
        this.error =
          err?.error?.error ??
          'Could not sign in to n8n. Check N8N_OWNER_* settings and restart the stack.';
        this.loading = false;
        this.sessionStarted = false;
      },
    });
  }
}
