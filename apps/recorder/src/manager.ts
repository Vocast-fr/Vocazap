import { eq } from 'drizzle-orm'
import { radios, type Db } from '@vocazap/db'
import { RadioSupervisor } from './supervisor.js'

/**
 * Maintient un superviseur par radio active. Re-synchronise régulièrement
 * avec la base : radios ajoutées/activées -> démarrage, désactivées ->
 * arrêt, URL modifiée -> redémarrage.
 */
export class RecorderManager {
  private supervisors = new Map<number, RadioSupervisor>()

  constructor(private db: Db) {}

  async sync(): Promise<void> {
    const active = await this.db.query.radios.findMany({ where: eq(radios.active, true) })
    const activeIds = new Set(active.map((r) => r.id))

    for (const [id, sup] of this.supervisors) {
      if (!activeIds.has(id)) {
        console.log(`[manager] arrêt ${sup.radio.slug}`)
        await sup.stop()
        this.supervisors.delete(id)
      }
    }

    for (const radio of active) {
      const existing = this.supervisors.get(radio.id)
      if (!existing) {
        const sup = new RadioSupervisor(this.db, radio)
        this.supervisors.set(radio.id, sup)
        sup.start()
      } else if (
        existing.radio.streamUrl !== radio.streamUrl ||
        existing.radio.streamType !== radio.streamType
      ) {
        console.log(`[manager] flux modifié, redémarrage ${radio.slug}`)
        await existing.restartWith(radio)
      }
    }

    console.log(`[manager] ${this.supervisors.size} radios en cours d'enregistrement`)
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.supervisors.values()].map((s) => s.stop()))
    this.supervisors.clear()
  }
}
