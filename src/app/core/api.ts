/**
 * Step 18b: tiny client for the nPro .NET API (same origin: IIS in production, the `ng serve` proxy in development).
 * Uses fetch (no Angular DI) so the DataStore can call it without changing how it is created or tested.
 * Sign-in is a cookie; writes echo the XSRF-TOKEN cookie in the X-XSRF-TOKEN header.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** True when there is no API at all (offline demo): network failure, 404 from a static server, or the dev proxy's 502-504 */
export function isNoBackend(err: unknown) {
  return !(err instanceof ApiError) || [0, 404, 502, 503, 504].includes(err.status);
}

function xsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]!) : '';
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-XSRF-TOKEN': xsrfToken() } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'The server can’t be reached');
  }
  const text = await res.text();
  const json = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = (json && (json.detail || json.title)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  // A static file server answers unknown paths with index.html: that means there is no API
  if (text && !json) throw new ApiError(404, 'No API at this address');
  return json as T;
}
