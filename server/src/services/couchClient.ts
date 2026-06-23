import { getCouchCredentials } from './couchAuth';

const COUCHDB_INTERNAL_URL = process.env.COUCHDB_INTERNAL_URL ?? 'http://127.0.0.1:5984';

function authHeader(): string {
  const { username, password } = getCouchCredentials();
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: authHeader(), ...extra };
}

export async function listDocuments<T extends { _id?: string }>(db: string): Promise<T[]> {
  const res = await fetch(`${COUCHDB_INTERNAL_URL}/${encodeURIComponent(db)}/_all_docs?include_docs=true`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list '${db}' (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    rows: Array<{ id: string; doc?: T }>;
  };

  return body.rows
    .filter((row) => row.doc && !row.id.startsWith('_'))
    .map((row) => row.doc as T);
}

export async function getDocument<T>(db: string, id: string): Promise<T | null> {
  const res = await fetch(`${COUCHDB_INTERNAL_URL}/${encodeURIComponent(db)}/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get '${db}/${id}' (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export async function putDocument<T extends { _id?: string; _rev?: string }>(
  db: string,
  id: string,
  doc: T
): Promise<{ id: string; rev: string }> {
  const res = await fetch(`${COUCHDB_INTERNAL_URL}/${encodeURIComponent(db)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...doc, _id: id }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save '${db}/${id}' (${res.status}): ${text}`);
  }
  return (await res.json()) as { id: string; rev: string };
}
