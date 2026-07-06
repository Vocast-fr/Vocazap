import type { Paginated, RadioDTO, RecordingDTO } from '@vocazap/shared'

export const API_URL = (process.env.PIGES_API_URL ?? 'https://api.piges.vocast.fr').replace(/\/$/, '')

export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined) qs.set(k, String(v))
  }
  const url = `${API_URL}${path}${qs.size ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API piges HTTP ${res.status} sur ${path} : ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  radios: (q?: { category?: string; q?: string }) => apiGet<RadioDTO[]>('/api/radios', q),
  radio: (slug: string) => apiGet<RadioDTO>(`/api/radios/${encodeURIComponent(slug)}`),
  recordings: (params: {
    radio?: string
    date?: string
    hour?: number
    category?: string
    page?: number
    pageSize?: number
  }) => apiGet<Paginated<RecordingDTO>>('/api/recordings', params),
  recording: (id: number) => apiGet<RecordingDTO>(`/api/recordings/${id}`)
}

export function audioUrl(recordingId: number, download = false): string {
  return `${API_URL}/api/recordings/${recordingId}/audio${download ? '?download' : ''}`
}

/**
 * Plage d'octets correspondant à [start, end] secondes d'une pige (flux CBR :
 * offset ≈ taille × temps / durée, marge amont de 0,3 s pour retomber sur une
 * frame complète — même mécanique que l'extraction du player web).
 */
export function byteRangeFor(
  rec: Pick<RecordingDTO, 'fileSize' | 'durationSeconds'>,
  startSeconds: number,
  endSeconds: number
): { start: number; end: number } | null {
  if (!rec.fileSize || !rec.durationSeconds) return null
  const bps = rec.fileSize / rec.durationSeconds
  return {
    start: Math.max(0, Math.floor((startSeconds - 0.3) * bps)),
    end: Math.min(rec.fileSize - 1, Math.ceil(endSeconds * bps))
  }
}
