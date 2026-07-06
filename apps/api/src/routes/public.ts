import type { FastifyInstance } from 'fastify'
import { and, asc, count, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { request as undiciRequest } from 'undici'
import { radios, recordings, type Db } from '@vocazap/db'
import { z } from 'zod'
import { toRadioDTO, toRecordingDTO } from '../dto.js'

const recordingsQuerySchema = z.object({
  radio: z.string().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  category: z.string().min(1).max(2).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(300).default(50)
})

/** Bornes UTC d'un jour civil (ou d'une heure précise) Europe/Paris, calculées côté SQL. */
function parisRange(date: string, hour?: number) {
  if (hour === undefined) {
    return {
      from: sql<Date>`(${date}::date::timestamp AT TIME ZONE 'Europe/Paris')`,
      to: sql<Date>`((${date}::date + 1)::timestamp AT TIME ZONE 'Europe/Paris')`
    }
  }
  return {
    from: sql<Date>`((${date}::date::timestamp + make_interval(hours => ${hour}::int)) AT TIME ZONE 'Europe/Paris')`,
    to: sql<Date>`((${date}::date::timestamp + make_interval(hours => ${hour}::int + 1)) AT TIME ZONE 'Europe/Paris')`
  }
}

export function registerPublicRoutes(app: FastifyInstance, db: Db) {
  app.get('/api/health', async () => ({ ok: true, at: new Date().toISOString() }))

  app.get<{ Querystring: { category?: string; q?: string } }>('/api/radios', async (req) => {
    const { category, q } = req.query
    const rows = await db.query.radios.findMany({
      where: and(
        eq(radios.active, true),
        category ? eq(radios.category, category) : undefined,
        q ? sql`unaccent(lower(${radios.name})) like unaccent(lower(${'%' + q + '%'}))` : undefined
      ),
      orderBy: [asc(radios.name)]
    })
    return rows.map(toRadioDTO)
  })

  app.get<{ Params: { slug: string } }>('/api/radios/:slug', async (req, reply) => {
    const radio = await db.query.radios.findFirst({ where: eq(radios.slug, req.params.slug) })
    if (!radio) return reply.code(404).send({ error: 'Radio inconnue' })
    return toRadioDTO(radio)
  })

  app.get('/api/recordings', async (req, reply) => {
    const parsed = recordingsQuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
    const { radio: radioSlug, date, hour, category, page, pageSize } = parsed.data

    let radioId: number | undefined
    if (radioSlug) {
      const radio = await db.query.radios.findFirst({ where: eq(radios.slug, radioSlug) })
      if (!radio) return reply.code(404).send({ error: 'Radio inconnue' })
      radioId = radio.id
    }

    const range = date ? parisRange(date, hour) : null
    const where = and(
      eq(recordings.status, 'uploaded'),
      radioId !== undefined ? eq(recordings.radioId, radioId) : undefined,
      category ? eq(radios.category, category) : undefined,
      range ? gte(recordings.startedAt, range.from) : undefined,
      range ? lt(recordings.startedAt, range.to) : undefined
    )

    const [items, [totalRow]] = await Promise.all([
      db
        .select({ rec: recordings, slug: radios.slug, name: radios.name })
        .from(recordings)
        .innerJoin(radios, eq(radios.id, recordings.radioId))
        .where(where)
        .orderBy(desc(recordings.startedAt), asc(radios.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ n: count() })
        .from(recordings)
        .innerJoin(radios, eq(radios.id, recordings.radioId))
        .where(where)
    ])

    return {
      items: items.map(({ rec, slug, name }) => toRecordingDTO(rec, { slug, name })),
      total: totalRow?.n ?? 0,
      page,
      pageSize
    }
  })

  app.get<{ Params: { id: string } }>('/api/recordings/:id', async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'id invalide' })
    const row = await db
      .select({ rec: recordings, slug: radios.slug, name: radios.name })
      .from(recordings)
      .innerJoin(radios, eq(radios.id, recordings.radioId))
      .where(eq(recordings.id, id))
      .limit(1)
    const first = row[0]
    if (!first) return reply.code(404).send({ error: 'Pige inconnue' })
    return toRecordingDTO(first.rec, { slug: first.slug, name: first.name })
  })

  /**
   * Proxy audio vers Pixeldrain avec support des requêtes Range :
   * indispensable pour le seek du player et l'extraction côté client
   * (CORS + Range garantis quelle que soit la politique de Pixeldrain).
   */
  const audioHandler = async (req: any, reply: any) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'id invalide' })
    const row = await db
      .select({ rec: recordings, slug: radios.slug })
      .from(recordings)
      .innerJoin(radios, eq(radios.id, recordings.radioId))
      .where(eq(recordings.id, id))
      .limit(1)
    const first = row[0]
    if (!first?.rec.fileId || first.rec.status !== 'uploaded') {
      return reply.code(404).send({ error: 'Fichier indisponible' })
    }

    const headers: Record<string, string> = {}
    if (req.headers.range) headers.range = String(req.headers.range)

    const upstream = await undiciRequest(`https://pixeldrain.com/api/file/${first.rec.fileId}`, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      headersTimeout: 30_000,
      bodyTimeout: 0
    })

    if (upstream.statusCode >= 400) {
      upstream.body.dump().catch(() => {})
      return reply.code(502).send({ error: `Stockage distant : HTTP ${upstream.statusCode}` })
    }

    const contentType = first.rec.format === 'aac' ? 'audio/aac' : 'audio/mpeg'
    const day = first.rec.startedAt.toISOString().slice(0, 10)
    const fileName = `${first.slug}_${day}_${first.rec.startedAt.toISOString().slice(11, 13)}h.${first.rec.format ?? 'mp3'}`

    reply
      .code(upstream.statusCode)
      .header('content-type', contentType)
      .header('accept-ranges', 'bytes')
      .header('cache-control', 'public, max-age=3600')
      .header(
        'content-disposition',
        `${'download' in (req.query as Record<string, unknown>) ? 'attachment' : 'inline'}; filename="${fileName}"`
      )
    for (const h of ['content-length', 'content-range'] as const) {
      const v = upstream.headers[h]
      if (v) reply.header(h, v as string)
    }
    return reply.send(upstream.body)
  }

  // Fastify expose aussi HEAD automatiquement pour cette route GET
  app.get('/api/recordings/:id/audio', audioHandler)
}
