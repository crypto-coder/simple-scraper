const N8N_INTERNAL_URL = process.env.N8N_INTERNAL_URL ?? 'http://127.0.0.1:5678';

export function getN8nOwnerCredentials(): { email: string; password: string } {
  return {
    email: process.env.N8N_OWNER_EMAIL ?? 'owner@simple-scraper.local',
    password: process.env.N8N_OWNER_PASSWORD ?? 'simple-scraper',
  };
}

export async function loginToN8n(): Promise<string[]> {
  const { email, password } = getN8nOwnerCredentials();

  const res = await fetch(`${N8N_INTERNAL_URL}/rest/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      emailOrLdapLoginId: email,
      password,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n login failed (${res.status}): ${text}`);
  }

  return typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : collectSetCookieHeaders(res.headers);
}

function collectSetCookieHeaders(headers: Headers): string[] {
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}
