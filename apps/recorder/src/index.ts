import cron from 'node-cron'
import { lt, sql } from 'drizzle-orm'
import { createDb, recordings, waitForDb } from '@vocazap/db'
import { config } from './config.js'
import { RecorderManager } from './manager.js'
import { guardDiskSpace, runPackager } from './packager.js'
import { purgeOldPixeldrainFiles } from './pixeldrain.js'

process.on('uncaughtException', (e) => console.error('uncaughtException', e))
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e))

async function main() {
  console.log(`🎙️  Vocazap recorder — buffer=${config.bufferDir}, rétention=${config.retentionDays} j`)
  await waitForDb(config.databaseUrl)
  const db = createDb(config.databaseUrl)

  // Attend que l'API ait appliqué les migrations (table radios disponible)
  for (let i = 0; i < 60; i++) {
    try {
      await db.execute(sql`select 1 from radios limit 1`)
      break
    } catch {
      if (i === 59) throw new Error('Table radios absente : l’API a-t-elle appliqué les migrations ?')
      await new Promise((r) => setTimeout(r, 3000))
    }
  }

  const manager = new RecorderManager(db)
  await manager.sync()

  // Re-synchronisation des radios (ajouts / retraits / URLs modifiées en admin)
  cron.schedule('*/5 * * * *', () => manager.sync().catch((e) => console.error('[manager] sync', e)))

  // Reconstitution + upload des heures terminées (rattrape aussi le backlog)
  cron.schedule('1-59/5 * * * *', () =>
    runPackager(db).catch((e) => console.error('[packager]', e))
  )
  void runPackager(db).catch((e) => console.error('[packager]', e))

  // Garde-fou disque
  cron.schedule('*/10 * * * *', () => guardDiskSpace())

  // Purge quotidienne : fichiers Pixeldrain > rétention + lignes en base marquées expirées
  cron.schedule('0 4 * * *', async () => {
    try {
      const deleted = await purgeOldPixeldrainFiles(config.retentionDays)
      const cutoff = new Date(Date.now() - config.retentionDays * 86_400_000)
      await db
        .update(recordings)
        .set({ status: 'expired', fileId: null })
        .where(lt(recordings.startedAt, cutoff))
      console.log(`[purge] ${deleted} fichiers Pixeldrain supprimés, lignes expirées marquées`)
    } catch (e) {
      console.error('[purge]', e)
    }
  })

  const shutdown = async () => {
    console.log('Arrêt du recorder…')
    await manager.stopAll()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((e) => {
  console.error('Fatal', e)
  process.exit(1)
})
