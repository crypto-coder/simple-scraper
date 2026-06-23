const COUCHDB_INTERNAL_URL = process.env.COUCHDB_INTERNAL_URL ?? 'http://127.0.0.1:5984';

const SYSTEM_DATABASES = ['_users', '_replicator'] as const;
const APP_DATABASES = ['projects', 'executions', 'scrapes'] as const;

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

async function waitForCouchReady(maxWaitMs = 60_000): Promise<void> {
  const auth = couchAuthHeader();
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const up = await fetch(`${COUCHDB_INTERNAL_URL}/_up`);
      if (!up.ok) {
        await sleep(2000);
        continue;
      }
      const dbs = await fetch(`${COUCHDB_INTERNAL_URL}/_all_dbs`, {
        headers: { Authorization: auth },
      });
      if (dbs.ok) return;
    } catch {
      /* CouchDB may be restarting */
    }
    await sleep(2000);
  }

  throw new Error('CouchDB did not become ready after restart');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ensure system and app databases exist (idempotent). */
export async function ensureCouchDatabases(): Promise<void> {
  const auth = couchAuthHeader();
  let createdAny = false;

  for (const db of [...SYSTEM_DATABASES, ...APP_DATABASES]) {
    const res = await fetch(`${COUCHDB_INTERNAL_URL}/${encodeURIComponent(db)}`, {
      method: 'PUT',
      headers: { Authorization: auth },
    });
    if (res.status === 201) createdAny = true;
    if (res.status === 201 || res.status === 412) continue;
    const text = await res.text();
    throw new Error(`Failed to create CouchDB database '${db}' (${res.status}): ${text}`);
  }

  if (createdAny) {
    const restart = await fetch(`${COUCHDB_INTERNAL_URL}/_restart`, {
      method: 'POST',
      headers: { Authorization: auth },
    });
    if (restart.ok) {
      await waitForCouchReady();
    }
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
