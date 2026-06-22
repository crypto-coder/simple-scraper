import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ScrapeProgress } from '../../models';

@Component({
  selector: 'app-progress-panel',
  standalone: true,
  templateUrl: './progress-panel.component.html',
  styleUrl: './progress-panel.component.css',
})
export class ProgressPanelComponent {
  @Input() progress: ScrapeProgress | null = null;
  @Output() dismiss = new EventEmitter<void>();

  get percent(): number {
    if (!this.progress || this.progress.totalUrls === 0) return 0;
    return Math.round((this.progress.processedUrls / this.progress.totalUrls) * 100);
  }

  get isComplete(): boolean {
    return this.progress?.status === 'completed' || this.progress?.status === 'stopped';
  }

  logClass(level: string): string {
    return `log-${level}`;
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString();
  }
}
