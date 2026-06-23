const COUCHDB_INTERNAL_URL = process.env.COUCHDB_INTERNAL_URL ?? 'http://127.0.0.1:5984';

const APP_DATABASES = ['projects', 'executions'] as const;

export function getCouchCredentials(): { username: string; password: string } {
  return {
    username: process.env.COUCHDB_USER ?? 'admin',
    password: process.env.COUCHDB_PASSWORD ?? 'password',
  };
}

function couchAuthHeader(): string {
  const { username, password } = getCouchCredentials();
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

/** Ensure app databases exist (idempotent). */
export async function ensureCouchDatabases(): Promise<void> {
  const auth = couchAuthHeader();

  for (const db of APP_DATABASES) {
    const res = await fetch(`${COUCHDB_INTERNAL_URL}/${db}`, {
      method: 'PUT',
      headers: { Authorization: auth },
    });
    if (res.status === 201 || res.status === 412) continue;
    const text = await res.text();
    throw new Error(`Failed to create CouchDB database '${db}' (${res.status}): ${text}`);
  }
}

export async function loginToCouch(): Promise<string[]> {
  await ensureCouchDatabases();

  const { username, password } = getCouchCredentials();

  const res = await fetch(`${COUCHDB_INTERNAL_URL}/_session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ name: username, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CouchDB login failed (${res.status}): ${text}`);
  }

  return typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : collectSetCookieHeaders(res.headers);
}

function collectSetCookieHeaders(headers: Headers): string[] {
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}
