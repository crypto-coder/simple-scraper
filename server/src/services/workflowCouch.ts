import { randomUUID } from 'crypto';
import { ensureCouchDatabases } from './couchAuth';
import { getDocument, putDocument } from './couchClient';
import type { CouchDoc, Execution, Project, Result, Scrape } from '../types/records';

export async function createWorkflowExecution(project: Project): Promise<Execution> {
  await ensureCouchDatabases();

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
  await ensureCouchDatabases();

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

export async function upsertScrapeRecord(input: {
  scrape_id?: string;
  execution_id: string;
  page_url: string;
  scraped_text: string;
  summarized_text: string;
}): Promise<Scrape> {
  await ensureCouchDatabases();

  if (input.scrape_id) {
    const existing = await getDocument<CouchDoc<Scrape>>('scrapes', input.scrape_id);
    if (!existing) {
      throw new Error(`Scrape '${input.scrape_id}' not found`);
    }

    const scrape: Scrape = {
      scrape_id: input.scrape_id,
      execution_id: input.execution_id,
      page_url: input.page_url,
      scrape_date: existing.scrape_date,
      scraped_text: input.scraped_text,
      summarized_text: input.summarized_text,
    };
    await putDocument('scrapes', input.scrape_id, {
      ...existing,
      ...scrape,
    });
    return scrape;
  }

  return saveScrapeRecord(input);
}

export async function appendExecutionResults(
  executionId: string,
  results: Result[]
): Promise<{ execution_id: string; resultsCount: number }> {
  await ensureCouchDatabases();

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
