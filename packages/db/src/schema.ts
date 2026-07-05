import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core'

export const radios = pgTable(
  'radios',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    streamUrl: text('stream_url').notNull(),
    streamType: text('stream_type').notNull().default('mp3'), // mp3 | aac | hls
    category: text('category').notNull().default('D'), // A | B | C | D
    websiteUrl: text('website_url'),
    logoUrl: text('logo_url'),
    active: boolean('active').notNull().default(true),
    streamStatus: text('stream_status').notNull().default('unknown'), // unknown | ok | degraded | down
    lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
    lastError: text('last_error'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('radios_slug_idx').on(t.slug)]
)

export const recordings = pgTable(
  'recordings',
  {
    id: serial('id').primaryKey(),
    radioId: integer('radio_id')
      .notNull()
      .references(() => radios.id, { onDelete: 'cascade' }),
    /** Début de l'heure enregistrée (UTC). */
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    durationSeconds: real('duration_seconds'),
    completeness: real('completeness'),
    fileId: text('file_id'), // id Pixeldrain
    fileSize: bigint('file_size', { mode: 'number' }),
    format: text('format'), // mp3 | aac
    bitrateKbps: real('bitrate_kbps'),
    partsCount: integer('parts_count'),
    status: text('status').notNull().default('uploaded'), // uploaded | failed | expired
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('recordings_radio_hour_idx').on(t.radioId, t.startedAt),
    index('recordings_started_at_idx').on(t.startedAt)
  ]
)

export const streamEvents = pgTable(
  'stream_events',
  {
    id: serial('id').primaryKey(),
    radioId: integer('radio_id')
      .notNull()
      .references(() => radios.id, { onDelete: 'cascade' }),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    type: text('type').notNull(), // down | up | error | stall
    message: text('message')
  },
  (t) => [index('stream_events_at_idx').on(t.at)]
)

export type RadioRow = typeof radios.$inferSelect
export type NewRadioRow = typeof radios.$inferInsert
export type RecordingRow = typeof recordings.$inferSelect
export type NewRecordingRow = typeof recordings.$inferInsert
export type StreamEventRow = typeof streamEvents.$inferSelect
