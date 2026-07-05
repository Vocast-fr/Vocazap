import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import type { StreamType } from '@vocazap/shared'

const execFileAsync = promisify(execFile)

export const USER_AGENT = 'VocastPiges/2.0 (+https://vocast.fr)'

/** Extension de fichier selon le type de flux (HLS transporte quasi toujours de l'AAC). */
export function extFor(streamType: StreamType): 'mp3' | 'aac' {
  return streamType === 'mp3' ? 'mp3' : 'aac'
}

/**
 * Lance un ffmpeg qui enregistre le flux en continu, découpé pile aux heures
 * d'horloge grâce au muxer segment (-segment_atclocktime 1).
 * Chaque (re)démarrage écrit des fichiers `part` distincts : en cas de coupure,
 * l'heure est reconstituée en concaténant ses parts.
 */
export function spawnRecorder(opts: {
  streamUrl: string
  streamType: StreamType
  outPattern: string // ex: /buffer/france-inter/%Y-%m-%dT%H_p1736100000.mp3
}): ChildProcess {
  const { streamUrl, streamType, outPattern } = opts
  const isHttp = /^https?:/i.test(streamUrl)

  const args = [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-user_agent',
    USER_AGENT
  ]

  if (isHttp && streamType !== 'hls') {
    // Reconnexion gérée par ffmpeg pour les flux HTTP directs (icecast/shoutcast)
    args.push(
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max', '30'
    )
  }
  // Timeout lecture : évite un process suspendu sur un flux muet (15 s, en µs)
  args.push('-rw_timeout', '15000000')

  if (streamType === 'hls') {
    args.push('-live_start_index', '-1')
  }

  args.push(
    '-i', streamUrl,
    '-map', '0:a:0',
    '-c', 'copy',
    '-f', 'segment',
    '-segment_time', '3600',
    '-segment_atclocktime', '1',
    '-segment_format', streamType === 'mp3' ? 'mp3' : 'adts',
    '-strftime', '1',
    '-reset_timestamps', '1',
    outPattern
  )

  return spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
}

/** Concatène des parts (même codec) en un seul fichier, sans ré-encodage. */
export async function concatParts(parts: string[], outFile: string): Promise<void> {
  const listContent = parts.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join('\n')
  const { writeFile, unlink } = await import('node:fs/promises')
  const listFile = `${outFile}.list.txt`
  await writeFile(listFile, listContent)
  try {
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      outFile
    ])
  } finally {
    await unlink(listFile).catch(() => {})
  }
}

export interface ProbeResult {
  durationSeconds: number
  bitrateKbps: number | null
}

export async function probeFile(file: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-hide_banner', '-loglevel', 'error',
    '-show_entries', 'format=duration,bit_rate',
    '-of', 'json',
    file
  ])
  const parsed = JSON.parse(stdout) as { format?: { duration?: string; bit_rate?: string } }
  const durationSeconds = Number(parsed.format?.duration ?? 0)
  const bitRate = Number(parsed.format?.bit_rate ?? 0)
  return {
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    bitrateKbps: bitRate > 0 ? Math.round(bitRate / 1000) : null
  }
}
