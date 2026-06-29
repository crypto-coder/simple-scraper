import { randomUUID } from 'crypto';
import { ensureCouchDatabases } from './couchAuth';
import { deleteDocument, getDocument, putDocument } from './couchClient';
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
    scrapes: [],
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

export async function attachScrapesToExecution(
  executionId: string,
  scrapeIds: string[]
): Promise<{ execution_id: string; scrapesCount: number }> {
  await ensureCouchDatabases();

  const existing = await getDocument<CouchDoc<Execution>>('executions', executionId);
  if (!existing) {
    throw new Error(`Execution '${executionId}' not found`);
  }

  const existingScrapes = existing.scrapes ?? [];
  const mergedScrapes = [...existingScrapes];
  for (const scrapeId of scrapeIds) {
    if (!mergedScrapes.includes(scrapeId)) {
      mergedScrapes.push(scrapeId);
    }
  }

  await putDocument('executions', executionId, {
    ...existing,
    scrapes: mergedScrapes,
  });

  return { execution_id: executionId, scrapesCount: mergedScrapes.length };
}

export async function updateScrapeSummarizedText(
  scrapeId: string,
  summarizedText: string
): Promise<Scrape> {
  await ensureCouchDatabases();

  const existing = await getDocument<CouchDoc<Scrape>>('scrapes', scrapeId);
  if (!existing) {
    throw new Error(`Scrape '${scrapeId}' not found`);
  }

  const scrape: Scrape = {
    scrape_id: scrapeId,
    execution_id: existing.execution_id,
    page_url: existing.page_url,
    scrape_date: existing.scrape_date,
    scraped_text: existing.scraped_text,
    summarized_text: summarizedText,
  };
  await putDocument('scrapes', scrapeId, { ...existing, ...scrape });
  return scrape;
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

export async function deleteExecutionWithScrapes(executionId: string): Promise<void> {
  await ensureCouchDatabases();

  const existing = await getDocument<CouchDoc<Execution>>('executions', executionId);
  if (!existing?._rev) {
    throw new Error(`Execution '${executionId}' not found`);
  }

  for (const scrapeId of existing.scrapes ?? []) {
    const scrape = await getDocument<CouchDoc<Scrape>>('scrapes', scrapeId);
    if (scrape?._rev) {
      await deleteDocument('scrapes', scrapeId, scrape._rev);
    }
  }

  await deleteDocument('executions', executionId, existing._rev);
}
