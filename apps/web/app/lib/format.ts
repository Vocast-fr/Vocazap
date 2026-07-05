/** Date du jour (Europe/Paris) au format YYYY-MM-DD. */
export function todayParis(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

/** Heure Europe/Paris (0-23) d'un instant ISO. */
export function parisHour(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hour12: false
  }).formatToParts(new Date(iso))
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
}

/** Date Europe/Paris (YYYY-MM-DD) d'un instant ISO. */
export function parisDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso))
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris'
  }).format(new Date(`${date}T12:00:00`))
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':').map(Number)
  if (parts.some((p) => Number.isNaN(p) || p < 0)) return null
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!
  if (parts.length === 1) return parts[0]!
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} Go`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} Mo`
  return `${Math.round(bytes / 1e3)} ko`
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
