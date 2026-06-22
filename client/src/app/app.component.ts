import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProgressPanelComponent } from './components/progress-panel/progress-panel.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { WorkflowTabComponent } from './components/workflow-tab/workflow-tab.component';
import type { AppSettings, LlmOption, ScrapeProgress } from './models';
import { ScrapeService } from './services/scrape.service';
import { SettingsService } from './services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, SettingsModalComponent, ProgressPanelComponent, WorkflowTabComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  activeTab: 'scraper' | 'workflow' = 'scraper';
  urlsText = '';
  fieldsText = '';
  prompt = '';
  summarizePrompt = '';
  fieldPrompt = '';
  selectedModel = 'gemma4:e4b';
  models: LlmOption[] = [];

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
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.scrapeService.startStream();
    this.subs.add(
      this.scrapeService.getModels().subscribe((m) => (this.models = m))
    );
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

  onUrlsPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const urls = this.parseLines(pasted);
    const existing = this.parseLines(this.urlsText);
    this.urlsText = [...existing, ...urls].join('\n');
  }

  onFieldsPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const fields = this.parseLines(pasted);
    const existing = this.parseLines(this.fieldsText);
    this.fieldsText = [...existing, ...fields].join('\n');
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

  setActiveTab(tab: 'scraper' | 'workflow'): void {
    this.activeTab = tab;
    if (tab === 'workflow') {
      this.scrapeService.stopStream();
    } else {
      this.scrapeService.startStream();
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

    const urls = this.parseLines(this.urlsText);
    const fields = this.parseLines(this.fieldsText);
    if (!urls.length || !fields.length) return;

    this.showProgress = true;
    this.scrapeService
      .startScrape({
        urls,
        fields,
        prompt: this.prompt,
        summarizePrompt: this.summarizePrompt,
        fieldPrompt: this.fieldPrompt,
        localLlmModel: this.selectedModel,
      })
      .subscribe({
        error: (err) => console.error('Failed to start scrape', err),
      });
  }

  onDismissProgress(): void {
    this.scrapeService.dismissProgress().subscribe();
  }
}
