import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { createDb, runMigrations, seedRadios, waitForDb } from '@vocazap/db'
import { registerPublicRoutes } from './routes/public.js'
import { registerAdminRoutes } from './routes/admin.js'

const PORT = Number(process.env.PORT ?? 3000)
const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

async function main() {
  if (!JWT_SECRET || !ADMIN_PASSWORD) {
    throw new Error('JWT_SECRET et ADMIN_PASSWORD sont requis')
  }

  await waitForDb()
  await runMigrations()
  const db = createDb()

  if ((process.env.AUTO_SEED ?? 'true') === 'true') {
    try {
      await seedRadios(db, undefined, true)
    } catch (e) {
      console.warn('Seed automatique impossible (data/radios.json absent ?)', (e as Error).message)
    }
  }

  const app = Fastify({ logger: true, trustProxy: true })

  await app.register(cors, {
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : true,
    exposedHeaders: ['content-length', 'content-range', 'accept-ranges', 'content-disposition']
  })
  await app.register(jwt, { secret: JWT_SECRET })

  registerPublicRoutes(app, db)
  registerAdminRoutes(app, db, ADMIN_PASSWORD)

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`🚀 API Vocazap sur :${PORT}`)
}

main().catch((e) => {
  console.error('Fatal', e)
  process.exit(1)
})
