const COUCHDB_INTERNAL_URL = process.env.COUCHDB_INTERNAL_URL ?? 'http://127.0.0.1:5984';

export function getCouchCredentials(): { username: string; password: string } {
  return {
    username: process.env.COUCHDB_USER ?? 'admin',
    password: process.env.COUCHDB_PASSWORD ?? 'password',
  };
}

export async function loginToCouch(): Promise<string[]> {
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
