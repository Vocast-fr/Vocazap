import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export type Db = ReturnType<typeof createDb>

let client: ReturnType<typeof postgres> | null = null

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL manquante')
  client = postgres(databaseUrl, { max: 10, onnotice: () => {} })
  return drizzle(client, { schema })
}

export async function closeDb() {
  await client?.end()
  client = null
}

/** Attend que PostgreSQL soit joignable (utile au boot des containers). */
export async function waitForDb(databaseUrl = process.env.DATABASE_URL, retries = 30) {
  if (!databaseUrl) throw new Error('DATABASE_URL manquante')
  for (let i = 0; i < retries; i++) {
    const probe = postgres(databaseUrl, { max: 1, connect_timeout: 5 })
    try {
      await probe`select 1`
      await probe.end()
      return
    } catch {
      await probe.end({ timeout: 1 }).catch(() => {})
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('PostgreSQL injoignable après plusieurs tentatives')
}
