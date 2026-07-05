import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { request as undiciRequest } from 'undici'
import { radios, recordings, streamEvents, type Db } from '@vocazap/db'
import { slugify, RADIO_CATEGORIES, STREAM_TYPES } from '@vocazap/shared'
import { z } from 'zod'
import { toRadioDTO, toStreamEventDTO } from '../dto.js'

const radioBodySchema = z.object({
  name: z.string().min(1),
  streamUrl: z.string().url(),
  streamType: z.enum(STREAM_TYPES).default('mp3'),
  category: z.enum(Object.keys(RADIO_CATEGORIES) as [string, ...string[]]).default('D'),
  websiteUrl: z.string().url().nullish(),
  logoUrl: z.string().url().nullish(),
  active: z.boolean().default(true)
})

export function registerAdminRoutes(app: FastifyInstance, db: Db, adminPassword: string) {
  app.post<{ Body: { password?: string } }>('/api/admin/login', async (req, reply) => {
    const { password } = req.body ?? {}
    if (!password || password !== adminPassword) {
      return reply.code(401).send({ error: 'Mot de passe incorrect' })
    }
    const token = app.jwt.sign({ role: 'admin' }, { expiresIn: '24h' })
    return { token }
  })

  const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Authentification requise' })
    }
  }

  app.register(async (secured) => {
    secured.addHook('preHandler', requireAdmin)

    secured.get('/api/admin/radios', async () => {
      const rows = await db.query.radios.findMany({ orderBy: [radios.name] })
      return rows.map(toRadioDTO)
    })

    secured.post('/api/admin/radios', async (req, reply) => {
      const parsed = radioBodySchema.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
      const d = parsed.data
      const [row] = await db
        .insert(radios)
        .values({
          slug: slugify(d.name),
          name: d.name,
          streamUrl: d.streamUrl,
          streamType: d.streamType,
          category: d.category,
          websiteUrl: d.websiteUrl ?? null,
          logoUrl: d.logoUrl ?? null,
          active: d.active
        })
        .onConflictDoNothing({ target: radios.slug })
        .returning()
      if (!row) return reply.code(409).send({ error: 'Une radio avec ce nom existe déjà' })
      return toRadioDTO(row)
    })

    secured.patch<{ Params: { id: string } }>('/api/admin/radios/:id', async (req, reply) => {
      const id = Number(req.params.id)
      const parsed = radioBodySchema.partial().safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
      const d = parsed.data
      const [row] = await db
        .update(radios)
        .set({
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.streamUrl !== undefined ? { streamUrl: d.streamUrl, streamStatus: 'unknown', consecutiveFailures: 0 } : {}),
          ...(d.streamType !== undefined ? { streamType: d.streamType } : {}),
          ...(d.category !== undefined ? { category: d.category } : {}),
          ...(d.websiteUrl !== undefined ? { websiteUrl: d.websiteUrl } : {}),
          ...(d.logoUrl !== undefined ? { logoUrl: d.logoUrl } : {}),
          ...(d.active !== undefined ? { active: d.active } : {}),
          updatedAt: new Date()
        })
        .where(eq(radios.id, id))
        .returning()
      if (!row) return reply.code(404).send({ error: 'Radio inconnue' })
      return toRadioDTO(row)
    })

    secured.delete<{ Params: { id: string } }>('/api/admin/radios/:id', async (req, reply) => {
      const id = Number(req.params.id)
      const res = await db.delete(radios).where(eq(radios.id, id)).returning({ id: radios.id })
      if (!res.length) return reply.code(404).send({ error: 'Radio inconnue' })
      return { deleted: true }
    })

    /** Test rapide d'un flux : suit le HTTP et lit les premiers octets. */
    secured.post<{ Params: { id: string } }>('/api/admin/radios/:id/check', async (req, reply) => {
      const id = Number(req.params.id)
      const radio = await db.query.radios.findFirst({ where: eq(radios.id, id) })
      if (!radio) return reply.code(404).send({ error: 'Radio inconnue' })
      const startedAt = Date.now()
      try {
        const res = await undiciRequest(radio.streamUrl, {
          method: 'GET',
          headersTimeout: 10_000,
          bodyTimeout: 10_000,
          headers: { 'user-agent': 'VocastPiges/2.0 (+https://vocast.fr)' }
        })
        const contentType = String(res.headers['content-type'] ?? '')
        let bytes = 0
        for await (const chunk of res.body) {
          bytes += (chunk as Buffer).length
          if (bytes > 32_000) break
        }
        res.body.destroy?.()
        const ok = res.statusCode < 400 && bytes > 0
        return {
          ok,
          statusCode: res.statusCode,
          contentType,
          bytesRead: bytes,
          latencyMs: Date.now() - startedAt
        }
      } catch (e) {
        return { ok: false, error: (e as Error).message, latencyMs: Date.now() - startedAt }
      }
    })

    secured.get('/api/admin/health', async () => {
      const all = await db.query.radios.findMany({ orderBy: [radios.name] })
      const active = all.filter((r) => r.active)
      const down = active.filter((r) => r.streamStatus === 'down' || r.streamStatus === 'degraded')

      const since = new Date(Date.now() - 24 * 3600_000)
      const events = await db
        .select({ ev: streamEvents, name: radios.name })
        .from(streamEvents)
        .innerJoin(radios, eq(radios.id, streamEvents.radioId))
        .where(gte(streamEvents.at, since))
        .orderBy(desc(streamEvents.at))
        .limit(100)

      const coverage = await db
        .select({
          radioId: recordings.radioId,
          uploaded: sql<number>`count(*)::int`
        })
        .from(recordings)
        .where(and(gte(recordings.startedAt, since), eq(recordings.status, 'uploaded')))
        .groupBy(recordings.radioId)
      const coverageMap = new Map(coverage.map((c) => [c.radioId, c.uploaded]))

      return {
        radiosTotal: all.length,
        radiosActive: active.length,
        radiosDown: down.map(toRadioDTO),
        recentEvents: events.map(({ ev, name }) => toStreamEventDTO(ev, name)),
        coverage24h: active.map((r) => ({
          radioId: r.id,
          slug: r.slug,
          name: r.name,
          uploaded: coverageMap.get(r.id) ?? 0,
          expected: 24
        }))
      }
    })
  })
}
