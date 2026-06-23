import { randomUUID } from 'crypto';
import { getDocument, putDocument } from './couchClient';
import type { CouchDoc, Execution, Project, Result, Scrape } from '../types/records';

export async function createWorkflowExecution(project: Project): Promise<Execution> {
  const execution_id = randomUUID();
  const execution_time = new Date().toISOString();
  const execution: Execution = {
    execution_id,
    execution_label: `${project.project_name} - ${execution_time}`,
    execution_time,
    project,
    results: [],
  };
  await putDocument('executions', execution_id, execution as CouchDoc<Execution>);
  return execution;
}

export async function saveScrapeRecord(input: {
  execution_id: string;
  page_url: string;
  scraped_text: string;
  summarized_text: string;
}): Promise<Scrape> {
  const scrape_id = randomUUID();
  const scrape: Scrape = {
    scrape_id,
    execution_id: input.execution_id,
    page_url: input.page_url,
    scrape_date: new Date().toISOString(),
    scraped_text: input.scraped_text,
    summarized_text: input.summarized_text,
  };
  await putDocument('scrapes', scrape_id, scrape as CouchDoc<Scrape>);
  return scrape;
}

export async function appendExecutionResults(
  executionId: string,
  results: Result[]
): Promise<{ execution_id: string; resultsCount: number }> {
  const existing = await getDocument<CouchDoc<Execution>>('executions', executionId);
  if (!existing) {
    throw new Error(`Execution '${executionId}' not found`);
  }

  const mergedResults = [...(existing.results ?? []), ...results];
  await putDocument('executions', executionId, {
    ...existing,
    results: mergedResults,
  });

  return { execution_id: executionId, resultsCount: mergedResults.length };
}
