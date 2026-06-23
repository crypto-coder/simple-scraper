import { randomUUID } from 'crypto';
import { Router } from 'express';
import { deleteDocument, getDocument, listDocuments, putDocument } from '../services/couchClient';
import type { CouchDoc, Project } from '../types/records';

export const projectsRouter = Router();

type ProjectInput = Omit<Project, 'project_id'> & { project_id?: string };

projectsRouter.get('/', async (_req, res) => {
  try {
    const docs = await listDocuments<CouchDoc<Project>>('projects');
    const projects = docs
      .map(stripCouchMeta)
      .sort((a, b) => a.project_name.localeCompare(b.project_name));
    res.json(projects);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.get('/:id', async (req, res) => {
  try {
    const doc = await getDocument<CouchDoc<Project>>('projects', req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(stripCouchMeta(doc));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.post('/', async (req, res) => {
  try {
    const body = req.body as ProjectInput;
    if (!body.project_name?.trim()) {
      res.status(400).json({ error: 'project_name is required' });
      return;
    }

    const project: Project = {
      project_id: randomUUID(),
      project_name: body.project_name.trim(),
      website_urls: body.website_urls ?? [],
      output_fields: body.output_fields ?? [],
      main_prompt: body.main_prompt ?? '',
      summarize_prompt: body.summarize_prompt ?? '',
      field_extract_prompt: body.field_extract_prompt ?? '',
      local_llm: body.local_llm ?? 'gemma4:e4b',
    };

    await putDocument('projects', project.project_id, project as CouchDoc<Project>);
    res.status(201).json(project);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.put('/:id', async (req, res) => {
  try {
    const body = req.body as Project;
    if (!body.project_id || body.project_id !== req.params.id) {
      res.status(400).json({ error: 'project_id must match URL id' });
      return;
    }
    if (!body.project_name?.trim()) {
      res.status(400).json({ error: 'project_name is required' });
      return;
    }

    const existing = await getDocument<CouchDoc<Project>>('projects', req.params.id);
    const saved = await putDocument('projects', req.params.id, {
      ...body,
      _rev: existing?._rev,
    });
    res.json({ ...body, _rev: saved.rev });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.delete('/:id', async (req, res) => {
  try {
    const existing = await getDocument<CouchDoc<Project>>('projects', req.params.id);
    if (!existing?._rev) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    await deleteDocument('projects', req.params.id, existing._rev);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

function stripCouchMeta(doc: CouchDoc<Project>): Project {
  const { _id, _rev, ...project } = doc;
  return project;
}
