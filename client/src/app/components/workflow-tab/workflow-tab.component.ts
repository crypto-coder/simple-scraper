import { Component } from '@angular/core';

@Component({
  selector: 'app-workflow-tab',
  standalone: true,
  templateUrl: './workflow-tab.component.html',
  styleUrl: './workflow-tab.component.css',
})
export class WorkflowTabComponent {
  readonly workflowUrl = '/workflow/';
}
