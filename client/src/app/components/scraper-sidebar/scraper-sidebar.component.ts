import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { Execution, Project } from '../../models';

@Component({
  selector: 'app-scraper-sidebar',
  standalone: true,
  templateUrl: './scraper-sidebar.component.html',
  styleUrl: './scraper-sidebar.component.css',
})
export class ScraperSidebarComponent {
  @Input({ required: true }) projects: Project[] = [];
  @Input({ required: true }) executions: Execution[] = [];
  @Input() selectedProjectId: string | null = null;
  @Input() selectedExecutionId: string | null = null;
  @Input() loadingProjects = false;
  @Input() loadingExecutions = false;

  @Output() projectSelect = new EventEmitter<Project>();
  @Output() executionSelect = new EventEmitter<Execution>();
  @Output() newProject = new EventEmitter<void>();

  projectsOpen = true;
  executionsOpen = true;

  toggleProjects(): void {
    this.projectsOpen = !this.projectsOpen;
  }

  toggleExecutions(): void {
    this.executionsOpen = !this.executionsOpen;
  }

  onProjectClick(project: Project): void {
    this.projectSelect.emit(project);
  }

  onExecutionClick(execution: Execution): void {
    this.executionSelect.emit(execution);
  }

  formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
}
