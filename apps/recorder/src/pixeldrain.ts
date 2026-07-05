import { createReadStream, statSync } from 'node:fs'
import { request } from 'undici'
import { config } from './config.js'

const API = 'https://pixeldrain.com/api'

function weekNumber(date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDays = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000)
  return Math.ceil((pastDays + startOfYear.getDay() + 1) / 7)
}

/** Rotation hebdomadaire entre comptes Pixeldrain (répartit stockage et quotas). */
export function currentApiKey(offset = 0): string {
  const keys = config.pixeldrainApiKeys
  const key = keys[(weekNumber() + offset) % keys.length]
  if (!key) throw new Error('PIXELDRAIN_API_KEYS vide')
  return key
}

function authHeader(key: string): string {
  return 'Basic ' + Buffer.from(':' + key).toString('base64')
}

export async function uploadToPixeldrain(filePath: string, fileName: string): Promise<{ id: string; size: number }> {
  const size = statSync(filePath).size
  const res = await request(`${API}/file/${encodeURIComponent(fileName)}`, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(currentApiKey()),
      'Content-Length': String(size)
    },
    body: createReadStream(filePath),
    headersTimeout: 60_000,
    bodyTimeout: 30 * 60_000
  })
  const text = await res.body.text()
  if (res.statusCode >= 300) throw new Error(`Pixeldrain upload ${res.statusCode} : ${text.slice(0, 200)}`)
  const { id } = JSON.parse(text) as { id: string }
  return { id, size }
}

/** Supprime, sur tous les comptes, les fichiers plus vieux que la rétention. */
export async function purgeOldPixeldrainFiles(retentionDays: number): Promise<number> {
  let deleted = 0
  for (let i = 0; i < config.pixeldrainApiKeys.length; i++) {
    const auth = authHeader(currentApiKey(i))
    try {
      const res = await request(`${API}/user/files`, { headers: { Authorization: auth } })
      if (res.statusCode >= 300) continue
      const { files } = (await res.body.json()) as { files: { id: string; date_upload: string }[] }
      for (const f of files) {
        const ageDays = (Date.now() - new Date(f.date_upload).getTime()) / 86_400_000
        if (ageDays > retentionDays) {
          try {
            await request(`${API}/file/${f.id}`, { method: 'DELETE', headers: { Authorization: auth } })
            deleted++
          } catch (e) {
            console.error(`Purge Pixeldrain : échec suppression ${f.id}`, e)
          }
        }
      }
    } catch (e) {
      console.error('Purge Pixeldrain : listing impossible', e)
    }
  }
  return deleted
}
