import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AppSettings } from '../../models';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.css',
})
export class SettingsModalComponent {
  @Input() settings: AppSettings = {
    CLOUD_LLM_URL: '',
    CLOUD_LLM_API_KEY: '',
    LOCAL_LLM_MODEL: 'gemma4:e4b',
    OLLAMA_MODELS: './models',
    OUTPUT_FOLDER: './output',
  };
  @Output() save = new EventEmitter<AppSettings>();
  @Output() cancel = new EventEmitter<void>();

  onSave(): void {
    this.save.emit({ ...this.settings });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onCancel();
    }
  }
}
