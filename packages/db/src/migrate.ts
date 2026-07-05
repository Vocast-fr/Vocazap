import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { waitForDb } from './client.js'

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

export async function runMigrations(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL manquante')
  await waitForDb(databaseUrl)
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  await migrate(drizzle(client), { migrationsFolder })
  await client.end()
  console.log('✅ Migrations appliquées')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
