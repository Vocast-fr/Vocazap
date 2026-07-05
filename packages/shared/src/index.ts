/** Catégories CSA simplifiées, telles que définies pour le projet. */
export const RADIO_CATEGORIES = {
  A: 'Associative',
  B: 'Locale indépendante',
  C: 'Locale réseau national',
  D: 'Nationale'
} as const

export type RadioCategory = keyof typeof RADIO_CATEGORIES

export const STREAM_TYPES = ['mp3', 'aac', 'hls'] as const
export type StreamType = (typeof STREAM_TYPES)[number]

export const STREAM_STATUSES = ['unknown', 'ok', 'degraded', 'down'] as const
export type StreamStatus = (typeof STREAM_STATUSES)[number]

export const RECORDING_STATUSES = ['uploaded', 'failed', 'expired'] as const
export type RecordingStatus = (typeof RECORDING_STATUSES)[number]

export interface RadioDTO {
  id: number
  slug: string
  name: string
  streamUrl: string
  streamType: StreamType
  category: RadioCategory
  websiteUrl: string | null
  logoUrl: string | null
  active: boolean
  streamStatus: StreamStatus
  lastOkAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  consecutiveFailures: number
}

export interface RecordingDTO {
  id: number
  radioId: number
  radioSlug?: string
  radioName?: string
  /** Début de l'heure enregistrée, ISO 8601 (UTC). */
  startedAt: string
  durationSeconds: number | null
  /** 0..1 : part de l'heure réellement capturée. */
  completeness: number | null
  fileSize: number | null
  format: string | null
  bitrateKbps: number | null
  partsCount: number | null
  status: RecordingStatus
}

export interface StreamEventDTO {
  id: number
  radioId: number
  radioName?: string
  at: string
  type: 'down' | 'up' | 'error' | 'stall'
  message: string | null
}

export interface HealthSummaryDTO {
  radiosTotal: number
  radiosActive: number
  radiosDown: RadioDTO[]
  recentEvents: StreamEventDTO[]
  /** Couverture des dernières 24 h : piges uploadées / attendues, par radio. */
  coverage24h: { radioId: number; slug: string; name: string; uploaded: number; expected: number }[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Slugifie un nom de radio ("France Bleu Île-de-France" -> "france-bleu-ile-de-france"). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
