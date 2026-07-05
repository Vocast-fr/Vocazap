import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import pLimit from 'p-limit'
import { and, eq } from 'drizzle-orm'
import { radios, recordings, type Db } from '@vocazap/db'
import { config } from './config.js'
import { concatParts, probeFile } from './ffmpeg.js'
import { uploadToPixeldrain } from './pixeldrain.js'

const PART_RE = /^(\d{4}-\d{2}-\d{2}T\d{2})_p(\d+)\.(mp3|aac)$/
const MAX_UPLOAD_ATTEMPTS = 12

const uploadAttempts = new Map<string, number>()
let running = false

interface HourGroup {
  slug: string
  hourLabel: string // "2026-07-05T14" (heure locale du container, TZ=Europe/Paris)
  ext: 'mp3' | 'aac'
  parts: { file: string; spawnTs: number }[]
}

/** "2026-07-05T14" (heure locale) -> Date du début d'heure. */
function hourLabelToDate(label: string): Date {
  return new Date(`${label}:00:00`)
}

function currentHourLabel(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`
}

async function collectFinishedHours(): Promise<HourGroup[]> {
  const groups = new Map<string, HourGroup>()
  const nowLabel = currentHourLabel()
  let slugs: string[] = []
  try {
    slugs = (await readdir(config.bufferDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
  } catch {
    return []
  }

  for (const slug of slugs) {
    const dir = join(config.bufferDir, slug)
    for (const f of await readdir(dir).catch(() => [] as string[])) {
      const m = f.match(PART_RE)
      if (!m) continue
      const [, hourLabel, spawnTs, ext] = m as unknown as [string, string, string, 'mp3' | 'aac']
      if (hourLabel >= nowLabel) continue // heure en cours : pas encore finie
      const key = `${slug}|${hourLabel}`
      const g = groups.get(key) ?? { slug, hourLabel, ext, parts: [] }
      g.parts.push({ file: join(dir, f), spawnTs: Number(spawnTs) })
      groups.set(key, g)
    }
  }
  return [...groups.values()]
}

async function processHour(db: Db, group: HourGroup): Promise<void> {
  const { slug, hourLabel, ext } = group
  const key = `${slug}|${hourLabel}`
  const startedAt = hourLabelToDate(hourLabel)
  const parts = group.parts.sort((a, b) => a.spawnTs - b.spawnTs).map((p) => p.file)

  const dropParts = () => Promise.all(parts.map((p) => rm(p, { force: true })))

  // Pige plus vieille que la rétention (gros backlog) : inutile de l'uploader
  if (Date.now() - startedAt.getTime() > config.retentionDays * 86_400_000) {
    console.warn(`[packager] ${key} plus vieille que la rétention, parts supprimées`)
    await dropParts()
    return
  }

  const radio = await db.query.radios.findFirst({ where: eq(radios.slug, slug) })
  if (!radio) {
    console.warn(`[packager] radio inconnue pour ${slug}, parts supprimées`)
    await dropParts()
    return
  }

  // Déjà uploadée (re-run après crash) ?
  const existing = await db.query.recordings.findFirst({
    where: and(eq(recordings.radioId, radio.id), eq(recordings.startedAt, startedAt))
  })
  if (existing?.status === 'uploaded') {
    await dropParts()
    return
  }

  const attempts = (uploadAttempts.get(key) ?? 0) + 1
  uploadAttempts.set(key, attempts)

  const workDir = join(config.bufferDir, '.work')
  await mkdir(workDir, { recursive: true })
  const merged = join(workDir, `${slug}_${hourLabel.replace(':', '-')}.${ext}`)

  try {
    if (parts.length === 1 && parts[0]) {
      await rm(merged, { force: true })
      const { copyFile } = await import('node:fs/promises')
      await copyFile(parts[0], merged)
    } else {
      await rm(merged, { force: true })
      await concatParts(parts, merged)
    }

    const { size } = await stat(merged)
    if (size < 10_000) throw new Error(`fichier trop petit (${size} o)`)

    const probe = await probeFile(merged)
    const completeness = Math.min(1, probe.durationSeconds / 3600)
    const day = hourLabel.slice(0, 10)
    const hour = hourLabel.slice(11, 13)
    const remoteName = `${slug}_${day}_${hour}h.${ext}`

    const { id: fileId } = await uploadToPixeldrain(merged, remoteName)

    await db
      .insert(recordings)
      .values({
        radioId: radio.id,
        startedAt,
        durationSeconds: Math.round(probe.durationSeconds),
        completeness,
        fileId,
        fileSize: size,
        format: ext,
        bitrateKbps: probe.bitrateKbps,
        partsCount: parts.length,
        status: 'uploaded'
      })
      .onConflictDoUpdate({
        target: [recordings.radioId, recordings.startedAt],
        set: {
          durationSeconds: Math.round(probe.durationSeconds),
          completeness,
          fileId,
          fileSize: size,
          format: ext,
          bitrateKbps: probe.bitrateKbps,
          partsCount: parts.length,
          status: 'uploaded'
        }
      })

    await dropParts()
    uploadAttempts.delete(key)
    console.log(
      `[packager] ✅ ${remoteName} (${(size / 1e6).toFixed(1)} Mo, ${Math.round(completeness * 100)} % de l'heure, ${parts.length} part(s))`
    )
  } catch (e) {
    console.error(`[packager] ❌ ${key} tentative ${attempts}/${MAX_UPLOAD_ATTEMPTS} :`, (e as Error).message)
    if (attempts >= MAX_UPLOAD_ATTEMPTS) {
      await db
        .insert(recordings)
        .values({ radioId: radio.id, startedAt, partsCount: parts.length, format: ext, status: 'failed' })
        .onConflictDoNothing()
      await dropParts()
      uploadAttempts.delete(key)
    }
  } finally {
    await rm(merged, { force: true })
  }
}

/**
 * Toutes les 5 min : reconstitue chaque heure terminée (concat des parts),
 * upload Pixeldrain, enregistre en base, nettoie. Rattrape automatiquement
 * le backlog (panne d'upload, redémarrage) puisqu'il rescanne le buffer.
 */
export async function runPackager(db: Db): Promise<void> {
  if (running) return
  running = true
  try {
    const groups = await collectFinishedHours()
    if (!groups.length) return
    const limit = pLimit(config.uploadConcurrency)
    await Promise.all(groups.map((g) => limit(() => processHour(db, g))))
  } finally {
    running = false
  }
}

/** Garde-fou disque : si l'espace libre est trop bas, supprime les parts les plus anciennes. */
export async function guardDiskSpace(): Promise<void> {
  const { statfs } = await import('node:fs/promises')
  if (!existsSync(config.bufferDir)) return
  try {
    const s = await statfs(config.bufferDir)
    const freeGb = (s.bavail * s.bsize) / 1e9
    if (freeGb >= config.minFreeDiskGb) return
    console.warn(`[disk] Espace libre bas (${freeGb.toFixed(1)} Go), purge des parts les plus anciennes`)
    const all: { file: string; mtime: number }[] = []
    for (const slug of await readdir(config.bufferDir)) {
      const dir = join(config.bufferDir, slug)
      for (const f of await readdir(dir).catch(() => [] as string[])) {
        const st = await stat(join(dir, f)).catch(() => null)
        if (st?.isFile()) all.push({ file: join(dir, f), mtime: st.mtimeMs })
      }
    }
    all.sort((a, b) => a.mtime - b.mtime)
    for (const { file } of all.slice(0, Math.ceil(all.length / 4))) {
      await rm(file, { force: true })
    }
  } catch (e) {
    console.error('[disk] garde-fou impossible', e)
  }
}
