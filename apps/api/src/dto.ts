import type { RadioRow, RecordingRow, StreamEventRow } from '@vocazap/db'
import type {
  RadioCategory,
  RadioDTO,
  RecordingDTO,
  RecordingStatus,
  StreamEventDTO,
  StreamStatus,
  StreamType
} from '@vocazap/shared'

export function toRadioDTO(r: RadioRow): RadioDTO {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    streamUrl: r.streamUrl,
    streamType: r.streamType as StreamType,
    category: r.category as RadioCategory,
    websiteUrl: r.websiteUrl,
    logoUrl: r.logoUrl,
    active: r.active,
    streamStatus: r.streamStatus as StreamStatus,
    lastOkAt: r.lastOkAt?.toISOString() ?? null,
    lastErrorAt: r.lastErrorAt?.toISOString() ?? null,
    lastError: r.lastError,
    consecutiveFailures: r.consecutiveFailures
  }
}

export function toRecordingDTO(rec: RecordingRow, radio?: Pick<RadioRow, 'slug' | 'name'>): RecordingDTO {
  return {
    id: rec.id,
    radioId: rec.radioId,
    radioSlug: radio?.slug,
    radioName: radio?.name,
    startedAt: rec.startedAt.toISOString(),
    durationSeconds: rec.durationSeconds,
    completeness: rec.completeness,
    fileSize: rec.fileSize,
    format: rec.format,
    bitrateKbps: rec.bitrateKbps,
    partsCount: rec.partsCount,
    status: rec.status as RecordingStatus
  }
}

export function toStreamEventDTO(e: StreamEventRow, radioName?: string): StreamEventDTO {
  return {
    id: e.id,
    radioId: e.radioId,
    radioName,
    at: e.at.toISOString(),
    type: e.type as StreamEventDTO['type'],
    message: e.message
  }
}
