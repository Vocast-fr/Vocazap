import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { sql } from 'drizzle-orm'
import { slugify, type RadioCategory, type StreamType } from '@vocazap/shared'
import { createDb, closeDb, type Db } from './client.js'
import { radios } from './schema.js'

interface SeedRadio {
  name: string
  streamUrl: string
  streamType?: StreamType
  category?: RadioCategory
  websiteUrl?: string
  logoUrl?: string
}

const defaultSeedPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data', 'radios.json')

/**
 * Upsert (par slug) des radios de data/radios.json.
 * N'écrase jamais une radio désactivée ou modifiée en admin : on ne touche
 * qu'aux colonnes name/website/logo si la radio existe déjà.
 */
export async function seedRadios(db: Db, seedPath = defaultSeedPath, onlyIfEmpty = false) {
  const list: SeedRadio[] = JSON.parse(readFileSync(seedPath, 'utf-8'))

  if (onlyIfEmpty) {
    const [{ count }] = (await db.execute(sql`select count(*)::int as count from radios`)) as unknown as [
      { count: number }
    ]
    if (count > 0) return { inserted: 0, skipped: list.length }
  }

  let inserted = 0
  for (const r of list) {
    const slug = slugify(r.name)
    const res = await db
      .insert(radios)
      .values({
        slug,
        name: r.name,
        streamUrl: r.streamUrl,
        streamType: r.streamType ?? 'mp3',
        category: r.category ?? 'D',
        websiteUrl: r.websiteUrl ?? null,
        logoUrl: r.logoUrl ?? null
      })
      .onConflictDoUpdate({
        target: radios.slug,
        set: {
          name: r.name,
          websiteUrl: r.websiteUrl ?? null,
          logoUrl: r.logoUrl ?? null,
          updatedAt: new Date()
        }
      })
      .returning({ id: radios.id })
    if (res.length) inserted++
  }
  console.log(`✅ Seed radios : ${inserted}/${list.length} upserts`)
  return { inserted, skipped: list.length - inserted }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createDb()
  seedRadios(db)
    .then(() => closeDb())
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
