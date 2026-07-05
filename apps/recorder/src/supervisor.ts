import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { eq, sql } from 'drizzle-orm'
import { radios, streamEvents, type Db, type RadioRow } from '@vocazap/db'
import type { StreamStatus, StreamType } from '@vocazap/shared'
import { config } from './config.js'
import { extFor, spawnRecorder } from './ffmpeg.js'

const WATCHDOG_INTERVAL_MS = 30_000
const STALL_AFTER_MS = 90_000
const HEALTHY_AFTER_MS = 60_000

/**
 * Un superviseur par radio : maintient un ffmpeg vivant, détecte les
 * blocages (octets qui ne progressent plus), relance avec backoff
 * exponentiel, et espace fortement les retries quand le flux est mort
 * pour ne pas tourner en boucle.
 */
export class RadioSupervisor {
  private proc: ChildProcess | null = null
  private stopped = false
  private restartTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null
  private consecutiveFailures = 0
  private status: StreamStatus = 'unknown'
  private spawnedAt = 0
  private lastGrowthAt = 0
  private lastKnownSize = 0
  private stderrTail: string[] = []

  constructor(
    private db: Db,
    public radio: Pick<RadioRow, 'id' | 'slug' | 'name' | 'streamUrl' | 'streamType'>
  ) {}

  get dir(): string {
    return join(config.bufferDir, this.radio.slug)
  }

  start() {
    this.stopped = false
    this.spawnProcess()
  }

  async stop() {
    this.stopped = true
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.clearWatchdog()
    if (this.proc) {
      this.proc.kill('SIGTERM')
      this.proc = null
    }
  }

  /** À appeler si l'URL/type de flux a changé en admin. */
  async restartWith(radio: RadioSupervisor['radio']) {
    await this.stop()
    this.radio = radio
    this.consecutiveFailures = 0
    this.start()
  }

  private spawnProcess() {
    if (this.stopped) return
    mkdirSync(this.dir, { recursive: true })

    const ext = extFor(this.radio.streamType as StreamType)
    // p<timestamp> rend chaque (re)démarrage unique : pas de collision de parts
    const outPattern = join(this.dir, `%Y-%m-%dT%H_p${Date.now()}.${ext}`)

    this.stderrTail = []
    this.spawnedAt = Date.now()
    this.lastGrowthAt = Date.now()
    this.lastKnownSize = this.totalBufferSize()

    const proc = spawnRecorder({
      streamUrl: this.radio.streamUrl,
      streamType: this.radio.streamType as StreamType,
      outPattern
    })
    this.proc = proc

    proc.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean)
      this.stderrTail = [...this.stderrTail, ...lines].slice(-5)
    })

    proc.on('exit', (code, signal) => {
      if (this.proc !== proc) return
      this.proc = null
      this.clearWatchdog()
      if (this.stopped) return

      const ranMs = Date.now() - this.spawnedAt
      const producedData = this.totalBufferSize() > this.lastKnownSize
      const err = this.stderrTail.join(' | ') || `ffmpeg exit code=${code} signal=${signal}`

      if (ranMs > HEALTHY_AFTER_MS && producedData) {
        // Coupure d'un flux qui marchait : reprise rapide, la pige sera recollée
        this.consecutiveFailures = 0
        void this.recordEvent('error', `Coupure du flux (reprise) : ${err}`)
        this.scheduleRestart(2_000)
      } else {
        this.consecutiveFailures++
        void this.onFailure(err)
        this.scheduleRestart(this.backoffDelay())
      }
    })

    this.watchdog = setInterval(() => this.checkProgress(), WATCHDOG_INTERVAL_MS)
  }

  private checkProgress() {
    if (!this.proc) return
    const size = this.totalBufferSize()
    if (size > this.lastKnownSize) {
      this.lastKnownSize = size
      this.lastGrowthAt = Date.now()
      if (this.status !== 'ok' && Date.now() - this.spawnedAt > HEALTHY_AFTER_MS) {
        this.consecutiveFailures = 0
        void this.onHealthy()
      } else if (this.status === 'ok') {
        void this.heartbeat()
      }
      return
    }
    if (Date.now() - this.lastGrowthAt > STALL_AFTER_MS) {
      // Flux muet : on tue le process, l'exit handler gère le retry
      void this.recordEvent('stall', 'Aucune donnée reçue depuis 90 s, redémarrage')
      this.proc.kill('SIGKILL')
    }
  }

  private backoffDelay(): number {
    if (this.consecutiveFailures >= config.downThreshold) return config.downRetryMs
    return Math.min(5_000 * 2 ** (this.consecutiveFailures - 1), 5 * 60_000)
  }

  private scheduleRestart(delayMs: number) {
    if (this.stopped) return
    this.restartTimer = setTimeout(() => this.spawnProcess(), delayMs)
  }

  private clearWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog)
      this.watchdog = null
    }
  }

  private totalBufferSize(): number {
    try {
      return readdirSync(this.dir).reduce((sum, f) => {
        try {
          return sum + statSync(join(this.dir, f)).size
        } catch {
          return sum
        }
      }, 0)
    } catch {
      return 0
    }
  }

  private async onHealthy() {
    const wasDown = this.status === 'down'
    this.status = 'ok'
    await this.db
      .update(radios)
      .set({ streamStatus: 'ok', lastOkAt: new Date(), consecutiveFailures: 0, updatedAt: new Date() })
      .where(eq(radios.id, this.radio.id))
      .catch((e) => console.error(`[${this.radio.slug}] maj statut ok`, e))
    if (wasDown) await this.recordEvent('up', 'Flux rétabli')
  }

  private async heartbeat() {
    await this.db
      .update(radios)
      .set({ lastOkAt: new Date() })
      .where(eq(radios.id, this.radio.id))
      .catch(() => {})
  }

  private async onFailure(message: string) {
    const goesDown = this.consecutiveFailures === config.downThreshold
    const newStatus: StreamStatus = this.consecutiveFailures >= config.downThreshold ? 'down' : 'degraded'
    const statusChanged = this.status !== newStatus
    this.status = newStatus
    await this.db
      .update(radios)
      .set({
        streamStatus: newStatus,
        lastErrorAt: new Date(),
        lastError: message.slice(0, 500),
        consecutiveFailures: sql`${radios.consecutiveFailures} + 1`,
        updatedAt: new Date()
      })
      .where(eq(radios.id, this.radio.id))
      .catch((e) => console.error(`[${this.radio.slug}] maj statut erreur`, e))
    if (goesDown) {
      await this.recordEvent('down', `Flux indisponible après ${this.consecutiveFailures} échecs : ${message.slice(0, 300)}`)
      console.warn(`[${this.radio.slug}] passé DOWN, retry toutes les ${config.downRetryMs / 60000} min`)
    } else if (statusChanged) {
      await this.recordEvent('error', message.slice(0, 300))
    }
  }

  private async recordEvent(type: 'down' | 'up' | 'error' | 'stall', message: string) {
    await this.db
      .insert(streamEvents)
      .values({ radioId: this.radio.id, type, message })
      .catch((e) => console.error(`[${this.radio.slug}] insert event`, e))
  }
}
