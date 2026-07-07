const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const AUTH_TOKEN_KEY = 'professor_session_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * En una respuesta 401 limpiamos el token y avisamos vía evento de window
 * (en vez de importar React aquí) para que `AuthProvider` reaccione sin que
 * este módulo necesite conocer el árbol de componentes.
 */
function handleUnauthorized(status: number) {
  if (status === 401) {
    clearAuthToken();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
}

export class ApiError extends Error {}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new ApiError(`GET ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    const detail = await res.json().catch(() => ({}) as { message?: string });
    throw new ApiError(detail.message ?? `POST ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    const detail = await res.json().catch(() => ({}) as { message?: string });
    throw new ApiError(detail.message ?? `PATCH ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    handleUnauthorized(res.status);
    const detail = await res.json().catch(() => ({}) as { message?: string });
    throw new ApiError(detail.message ?? `DELETE ${path} -> ${res.status}`);
  }
}

export { API_BASE_URL };
