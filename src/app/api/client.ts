import { getAccessToken } from '../auth/supabase';

const workersEnabled = import.meta.env.VITE_WORKERS_ENABLED !== 'false';

export function getBaseUrl(): string {
  const baseUrl = (import.meta.env.VITE_MT_API_BASE_URL || import.meta.env.VITE_API_BASE_URL) as string | undefined;
  if (!baseUrl) throw new Error('VITE_API_BASE_URL is not set');
  // Prevent accidental double slashes in production.
  return baseUrl.replace(/\/+$/, '');
}

function resolveTenantSubdomain(): string | undefined {
  const envTenant = import.meta.env.VITE_MT_TENANT_SUBDOMAIN as string | undefined;
  if (envTenant) return envTenant;
  if (typeof window === 'undefined') return undefined;

  const match = window.location.pathname.match(/^\/t\/([^/]+)/i);
  if (match?.[1]) return match[1];

  const host = window.location.hostname;
  if (!host || host === 'localhost') return undefined;
  const parts = host.split('.').filter(Boolean);
  if (parts.length > 3) return parts[0];
  return undefined;
}

export function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  const h: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  const tenantSubdomain = resolveTenantSubdomain();
  if (tenantSubdomain) h['x-mt-tenant-slug'] = tenantSubdomain;
  if (!token) console.warn('Missing access token for API request');
  return h;
}

function getAuthPortalUrl(): string {
  const url = import.meta.env.VITE_AUTH_PORTAL_URL as string | undefined;
  if (!url) throw new Error('Missing required env var: VITE_AUTH_PORTAL_URL');
  return url;
}

function redirectToLogin(): void {
  window.location.href = getAuthPortalUrl();
}

export async function fetchJson<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  if (!workersEnabled) throw new Error('API is disabled (VITE_WORKERS_ENABLED=false)');

  const url = `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  const timeoutMs = init?.timeoutMs ?? 20000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...getAuthHeader(),
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${text}`);
    }

    return (await res.json()) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOpsDocumentSignedUrl(
  documentId: string
): Promise<{ url: string; kind: 'storage' | 'drive'; expires_in?: number }> {
  // Guard against accidentally calling the API with "undefined" / empty values.
  // This prevents noisy 500s and surfaces a clearer UI error.
  if (!documentId || documentId === 'undefined' || documentId === 'null') {
    throw new Error('Missing document id for signed URL lookup');
  }

  return await fetchJson(`/ops/documents/${encodeURIComponent(documentId)}/signed-url`, {
    method: 'GET',
  });
}
