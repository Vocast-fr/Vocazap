import type { HealthSummaryDTO, RadioDTO } from '@vocazap/shared'

declare global {
  interface Window {
    ENV?: { API_URL?: string }
  }
}

const API = () => window.ENV?.API_URL ?? 'http://localhost:3000'

export function getToken(): string | null {
  return localStorage.getItem('admin-token')
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('admin-token', token)
  else localStorage.removeItem('admin-token')
}

export class UnauthorizedError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
      ...init.headers
    }
  })
  if (res.status === 401) {
    setToken(null)
    throw new UnauthorizedError('Session expirée')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body.error === 'string' ? body.error : `Erreur HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const adminApi = {
  login: (password: string) =>
    call<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  radios: () => call<RadioDTO[]>('/api/admin/radios'),
  createRadio: (data: Partial<RadioDTO>) =>
    call<RadioDTO>('/api/admin/radios', { method: 'POST', body: JSON.stringify(data) }),
  updateRadio: (id: number, data: Partial<RadioDTO>) =>
    call<RadioDTO>(`/api/admin/radios/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRadio: (id: number) => call<{ deleted: boolean }>(`/api/admin/radios/${id}`, { method: 'DELETE' }),
  checkRadio: (id: number) =>
    call<{ ok: boolean; statusCode?: number; contentType?: string; bytesRead?: number; latencyMs: number; error?: string }>(
      `/api/admin/radios/${id}/check`,
      { method: 'POST' }
    ),
  health: () => call<HealthSummaryDTO>('/api/admin/health')
}
