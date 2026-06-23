import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatabaseTabComponent } from './components/database-tab/database-tab.component';
import { ProgressPanelComponent } from './components/progress-panel/progress-panel.component';
import { ScraperSidebarComponent } from './components/scraper-sidebar/scraper-sidebar.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { WorkflowTabComponent } from './components/workflow-tab/workflow-tab.component';
import type {
  AppSettings,
  Execution,
  OutputField,
  Project,
  ScrapeProgress,
} from './models';
import { LOCAL_LLM_OPTIONS } from './models';
import { ExecutionService } from './services/execution.service';
import { ProjectService } from './services/project.service';
import { ScrapeService } from './services/scrape.service';
import { SettingsService } from './services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    SettingsModalComponent,
    ProgressPanelComponent,
    WorkflowTabComponent,
    DatabaseTabComponent,
    ScraperSidebarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  activeTab: 'scraper' | 'workflow' | 'database' = 'scraper';

  projectId = '';
  projectName = '';
  urlsText = '';
  outputFields: OutputField[] = [{ field_name: '', extract_hint: '' }];
  prompt = '';
  summarizePrompt = '';
  fieldPrompt = '';
  selectedModel = LOCAL_LLM_OPTIONS[0].id;
  models = LOCAL_LLM_OPTIONS;

  projects: Project[] = [];
  executions: Execution[] = [];
  selectedProjectId: string | null = null;
  selectedExecutionId: string | null = null;
  selectedExecution: Execution | null = null;
  loadingProjects = false;
  loadingExecutions = false;
  savingProject = false;
  saveMessage: string | null = null;

  isRunning = false;
  showSettings = false;
  showProgress = false;
  progress: ScrapeProgress | null = null;
  settings: AppSettings = {
    CLOUD_LLM_URL: '',
    CLOUD_LLM_API_KEY: '',
    LOCAL_LLM_MODEL: 'gemma4:e4b',
    OLLAMA_MODELS: './models',
    OUTPUT_FOLDER: './output',
  };

  private subs = new Subscription();

  constructor(
    private scrapeService: ScrapeService,
    private settingsService: SettingsService,
    private projectService: ProjectService,
    private executionService: ExecutionService
  ) {}

  ngOnInit(): void {
    this.scrapeService.startStream();
    this.loadProjects();
    this.loadExecutions();
    this.loadModels();

    this.subs.add(
      this.scrapeService.getPromptDefaults().subscribe((d) => {
        this.summarizePrompt = d.summarizePrompt;
        this.fieldPrompt = d.fieldPrompt;
      })
    );
    this.subs.add(
      this.settingsService.getSettings().subscribe((s) => (this.settings = s))
    );
    this.subs.add(
      this.scrapeService.progress$.subscribe((p) => {
        if (!p) return;
        this.progress = p;
        if (p.status === 'running') {
          this.isRunning = true;
          this.showProgress = true;
        } else if (p.status === 'completed' || p.status === 'stopped' || p.status === 'error') {
          this.isRunning = false;
          if (p.status === 'completed') {
            this.loadExecutions();
          }
        }
        if (p.status === 'idle') {
          this.showProgress = false;
          this.progress = null;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.scrapeService.stopStream();
  }

  loadProjects(): void {
    this.loadingProjects = true;
    this.projectService.list().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.loadingProjects = false;
      },
      error: (err) => {
        console.error('Failed to load projects', err);
        this.loadingProjects = false;
      },
    });
  }

  loadModels(): void {
    this.scrapeService.getModels().subscribe({
      next: (models) => {
        if (models.length) {
          this.models = models;
          if (!this.models.some((m) => m.id === this.selectedModel)) {
            this.selectedModel = this.models[0].id;
          }
        }
      },
      error: (err) => {
        console.error('Failed to load LLM models, using defaults', err);
        this.models = LOCAL_LLM_OPTIONS;
      },
    });
  }

  loadExecutions(): void {
    this.loadingExecutions = true;
    this.executionService.list().subscribe({
      next: (executions) => {
        this.executions = executions;
        this.loadingExecutions = false;
      },
      error: (err) => {
        console.error('Failed to load executions', err);
        this.loadingExecutions = false;
      },
    });
  }

  onProjectSelect(project: Project): void {
    this.selectedProjectId = project.project_id;
    this.selectedExecutionId = null;
    this.selectedExecution = null;
    this.applyProject(project);
  }

  onExecutionSelect(execution: Execution): void {
    this.selectedExecutionId = execution.execution_id;
    this.selectedExecution = execution;
    this.selectedProjectId = execution.project.project_id;
    this.applyProject(execution.project);
  }

  onNewProject(): void {
    this.selectedProjectId = null;
    this.selectedExecutionId = null;
    this.selectedExecution = null;
    this.projectId = '';
    this.projectName = '';
    this.urlsText = '';
    this.outputFields = [{ field_name: '', extract_hint: '' }];
    this.prompt = '';
    this.saveMessage = null;
    this.subs.add(
      this.scrapeService.getPromptDefaults().subscribe((d) => {
        this.summarizePrompt = d.summarizePrompt;
        this.fieldPrompt = d.fieldPrompt;
      })
    );
  }

  applyProject(project: Project): void {
    this.projectId = project.project_id;
    this.projectName = project.project_name;
    this.urlsText = project.website_urls.join('\n');
    this.outputFields = project.output_fields.length
      ? project.output_fields.map((f) => ({ ...f }))
      : [{ field_name: '', extract_hint: '' }];
    this.prompt = project.main_prompt;
    this.summarizePrompt = project.summarize_prompt;
    this.fieldPrompt = project.field_extract_prompt;
    this.selectedModel = project.local_llm;
    this.saveMessage = null;
  }

  buildProjectInput(): Omit<Project, 'project_id'> | null {
    const website_urls = this.parseLines(this.urlsText);
    const output_fields = this.outputFields
      .map((f) => ({
        field_name: f.field_name.trim(),
        extract_hint: f.extract_hint.trim(),
      }))
      .filter((f) => f.field_name);

    if (!this.projectName.trim()) return null;
    if (!website_urls.length || !output_fields.length) return null;

    return {
      project_name: this.projectName.trim(),
      website_urls,
      output_fields,
      main_prompt: this.prompt,
      summarize_prompt: this.summarizePrompt,
      field_extract_prompt: this.fieldPrompt,
      local_llm: this.selectedModel,
    };
  }

  onSaveProject(): void {
    const input = this.buildProjectInput();
    if (!input) {
      this.saveMessage = 'Project name, at least one URL, and one output field are required.';
      return;
    }

    this.savingProject = true;
    this.saveMessage = null;

    const save$ = this.selectedProjectId
      ? this.projectService.update({ ...input, project_id: this.selectedProjectId })
      : this.projectService.create(input);

    save$.subscribe({
      next: (saved) => {
        this.savingProject = false;
        this.projectId = saved.project_id;
        this.selectedProjectId = saved.project_id;
        this.saveMessage = 'Project saved.';
        this.loadProjects();
      },
      error: (err) => {
        console.error('Failed to save project', err);
        this.savingProject = false;
        this.saveMessage = 'Failed to save project.';
      },
    });
  }

  addOutputField(): void {
    this.outputFields = [...this.outputFields, { field_name: '', extract_hint: '' }];
  }

  removeOutputField(index: number): void {
    if (this.outputFields.length <= 1) {
      this.outputFields = [{ field_name: '', extract_hint: '' }];
      return;
    }
    this.outputFields = this.outputFields.filter((_, i) => i !== index);
  }

  onUrlsPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const urls = this.parseLines(pasted);
    const existing = this.parseLines(this.urlsText);
    this.urlsText = [...existing, ...urls].join('\n');
  }

  onFieldsPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const names = this.parseLines(pasted);
    if (!names.length) return;

    const updated = [...this.outputFields];
    updated[index] = { ...updated[index], field_name: names[0] };
    for (let i = 1; i < names.length; i++) {
      updated.push({ field_name: names[i], extract_hint: '' });
    }
    this.outputFields = updated;
  }

  private parseLines(text: string): string[] {
    return text
      .split(/[\n,;\t|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  openSettings(): void {
    this.showSettings = true;
  }

  setActiveTab(tab: 'scraper' | 'workflow' | 'database'): void {
    this.activeTab = tab;
    if (tab === 'scraper') {
      this.scrapeService.startStream();
    } else {
      this.scrapeService.stopStream();
    }
  }

  onSettingsSave(updated: AppSettings): void {
    this.settingsService.saveSettings(updated).subscribe((s) => {
      this.settings = s;
      this.showSettings = false;
    });
  }

  onSettingsCancel(): void {
    this.showSettings = false;
  }

  onScrapeClick(): void {
    if (this.isRunning) {
      this.scrapeService.stopScrape().subscribe();
      return;
    }

    const input = this.buildProjectInput();
    if (!input) return;

    this.showProgress = true;
    this.scrapeService
      .startScrape({
        urls: input.website_urls,
        fields: input.output_fields.map((f) => f.field_name),
        prompt: input.main_prompt,
        summarizePrompt: input.summarize_prompt,
        fieldPrompt: input.field_extract_prompt,
        localLlmModel: input.local_llm,
      })
      .subscribe({
        error: (err) => console.error('Failed to start scrape', err),
      });
  }

  onDismissProgress(): void {
    this.scrapeService.dismissProgress().subscribe();
  }

  trackByIndex(index: number): number {
    return index;
  }
}
