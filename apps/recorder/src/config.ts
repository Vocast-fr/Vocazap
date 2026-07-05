import 'dotenv/config'

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`)
  return v
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  pixeldrainApiKeys: required('PIXELDRAIN_API_KEYS')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean),
  bufferDir: process.env.BUFFER_DIR ?? './buffer',
  retentionDays: Number(process.env.RETENTION_DAYS ?? 30),
  uploadConcurrency: Number(process.env.UPLOAD_CONCURRENCY ?? 3),
  /** Après ce nombre d'échecs consécutifs, la radio passe "down" et le retry est espacé. */
  downThreshold: Number(process.env.DOWN_THRESHOLD ?? 10),
  /** Intervalle de retry (ms) quand une radio est "down" — évite de tourner en boucle. */
  downRetryMs: Number(process.env.DOWN_RETRY_MS ?? 15 * 60_000),
  /** Espace disque libre minimal (Go) sous lequel on purge les parts les plus anciennes. */
  minFreeDiskGb: Number(process.env.MIN_FREE_DISK_GB ?? 5)
}
