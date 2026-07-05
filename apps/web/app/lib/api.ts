import type { Paginated, RadioDTO, RecordingDTO } from '@vocazap/shared'

/** URL de l'API vue du serveur SSR (réseau docker interne si dispo). */
export function serverApiUrl(): string {
  return process.env.API_URL ?? process.env.PUBLIC_API_URL ?? 'http://localhost:3000'
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Response(res.status === 404 ? 'Introuvable' : 'Erreur API', { status: res.status })
  return res.json() as Promise<T>
}

export const api = {
  radios: (q?: { category?: string }) =>
    get<RadioDTO[]>(`${serverApiUrl()}/api/radios${q?.category ? `?category=${q.category}` : ''}`),
  radio: (slug: string) => get<RadioDTO>(`${serverApiUrl()}/api/radios/${encodeURIComponent(slug)}`),
  recordings: (params: { radio?: string; date?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (params.radio) qs.set('radio', params.radio)
    if (params.date) qs.set('date', params.date)
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    return get<Paginated<RecordingDTO>>(`${serverApiUrl()}/api/recordings?${qs}`)
  }
}

/** URL audio (proxy Range de l'API) à utiliser côté client. */
export function audioUrl(publicApiUrl: string, recordingId: number, download = false): string {
  return `${publicApiUrl}/api/recordings/${recordingId}/audio${download ? '?download' : ''}`
}
