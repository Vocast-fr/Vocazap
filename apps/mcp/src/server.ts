import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { RADIO_CATEGORIES } from '@vocazap/shared'
import { api, audioUrl, byteRangeFor } from './api.js'

const CATEGORY_ENUM = z.enum(['A', 'B', 'C', 'D']).describe(
  'Catégorie CSA : A associative, B locale indépendante, C locale de réseau national, D nationale (généralistes et thématiques)'
)
const DATE_SCHEMA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Jour civil Europe/Paris, format YYYY-MM-DD')

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function err(message: string) {
  return { content: [{ type: 'text' as const, text: `Erreur : ${message}` }], isError: true }
}

const fmtHms = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(Math.floor(s % 60)).padStart(2, '0')
  return `${h}h${m}m${sec}s`
}

/** Heure Europe/Paris (0-23) d'un instant ISO. */
function parisHour(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hour12: false
  }).formatToParts(new Date(iso))
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
}

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: 'piges-radio-vocast', version: '1.0.0' },
    {
      instructions: `Serveur MCP « Les piges radio - Vocast » : bibliothèque des enregistrements heure par heure (~250 radios françaises, rétention 30 jours, fuseau Europe/Paris).

Workflow type — « comparer les journaux de 12h des radios généralistes » :
1. recordings_at_hour(date, hour=12, category="D") → une pige par radio généraliste
2. download_clip(recording_id, start_seconds=0, end_seconds=1200) pour chaque pige → fichiers MP3/AAC locaux (le journal dure rarement plus de 20 min)
3. Transcrire les fichiers avec votre outil de speech-to-text, puis comparer.

Notes : les piges couvrent une heure pleine (ex : 12h00→13h00 Paris) ; completeness < 1 signale une coupure du flux ; get_clip_access fournit URL + en-tête Range si vous préférez télécharger vous-même.`
    }
  )

  server.registerTool(
    'list_radios',
    {
      title: 'Lister les radios',
      description:
        'Liste les radios enregistrées (slug, nom, catégorie A/B/C/D, statut du flux). Filtrable par catégorie et par recherche texte. Le slug sert de clé pour les autres outils.',
      inputSchema: {
        category: CATEGORY_ENUM.optional(),
        query: z.string().optional().describe('Recherche insensible aux accents dans le nom')
      }
    },
    async ({ category, query }) => {
      const radios = await api.radios({ category, q: query })
      return json(
        radios.map((r) => ({
          slug: r.slug,
          name: r.name,
          category: r.category,
          categoryLabel: RADIO_CATEGORIES[r.category],
          streamStatus: r.streamStatus,
          website: r.websiteUrl
        }))
      )
    }
  )

  server.registerTool(
    'get_radio',
    {
      title: "Détail d'une radio",
      description: 'Fiche complète d’une radio à partir de son slug (flux, statut, dernière erreur).',
      inputSchema: { slug: z.string().describe('Slug de la radio, ex : france-inter') }
    },
    async ({ slug }) => json(await api.radio(slug))
  )

  server.registerTool(
    'list_recordings',
    {
      title: "Lister les piges d'une radio",
      description:
        "Piges disponibles d'une radio pour un jour donné (une par heure au mieux). Retourne pour chaque pige : id, heure Paris, durée, complétude (1 = heure entière), taille et URL audio.",
      inputSchema: {
        radio_slug: z.string().describe('Slug de la radio, ex : france-inter'),
        date: DATE_SCHEMA
      }
    },
    async ({ radio_slug, date }) => {
      const { items } = await api.recordings({ radio: radio_slug, date, pageSize: 48 })
      return json(
        items
          .map((r) => ({
            recording_id: r.id,
            hourParis: parisHour(r.startedAt),
            startedAt: r.startedAt,
            durationSeconds: r.durationSeconds,
            completeness: r.completeness,
            fileSizeBytes: r.fileSize,
            format: r.format,
            audioUrl: audioUrl(r.id)
          }))
          .sort((a, b) => a.hourParis - b.hourParis)
      )
    }
  )

  server.registerTool(
    'recordings_at_hour',
    {
      title: 'Piges de plusieurs radios à une heure donnée',
      description:
        "Photographie d'une heure précise à travers plusieurs radios — idéal pour comparer une même tranche (ex : le journal de 12h) entre stations. Filtre par catégorie et/ou liste de slugs.",
      inputSchema: {
        date: DATE_SCHEMA,
        hour: z.number().int().min(0).max(23).describe('Heure Europe/Paris (0-23), début de la pige'),
        category: CATEGORY_ENUM.optional(),
        radio_slugs: z.array(z.string()).optional().describe('Limiter à ces radios (slugs)')
      }
    },
    async ({ date, hour, category, radio_slugs }) => {
      const { items } = await api.recordings({ date, hour, category, pageSize: 300 })
      const filtered = radio_slugs?.length
        ? items.filter((r) => r.radioSlug && radio_slugs.includes(r.radioSlug))
        : items
      return json({
        date,
        hourParis: hour,
        count: filtered.length,
        recordings: filtered.map((r) => ({
          recording_id: r.id,
          radioSlug: r.radioSlug,
          radioName: r.radioName,
          durationSeconds: r.durationSeconds,
          completeness: r.completeness,
          fileSizeBytes: r.fileSize,
          format: r.format,
          audioUrl: audioUrl(r.id)
        }))
      })
    }
  )

  server.registerTool(
    'get_clip_access',
    {
      title: "Accès audio (pige entière ou extrait)",
      description:
        "Donne tout ce qu'il faut pour récupérer l'audio d'une pige : URL directe (Range supporté) et, si start/end fournis, l'en-tête Range exact + commandes curl/ffmpeg prêtes à l'emploi. Découpe par octets sans ré-encodage, précision ≈ 1 s.",
      inputSchema: {
        recording_id: z.number().int().describe('Id de pige retourné par list_recordings / recordings_at_hour'),
        start_seconds: z.number().min(0).optional().describe("Début de l'extrait (s depuis le début de l'heure)"),
        end_seconds: z.number().min(1).optional().describe("Fin de l'extrait (s)")
      }
    },
    async ({ recording_id, start_seconds, end_seconds }) => {
      const rec = await api.recording(recording_id)
      const url = audioUrl(recording_id)
      const base = {
        recording_id,
        radio: rec.radioSlug,
        startedAt: rec.startedAt,
        durationSeconds: rec.durationSeconds,
        format: rec.format,
        fileSizeBytes: rec.fileSize,
        audioUrl: url,
        downloadUrl: audioUrl(recording_id, true)
      }
      if (start_seconds === undefined || end_seconds === undefined) {
        return json({ ...base, curl: `curl -L -o pige.${rec.format ?? 'mp3'} "${audioUrl(recording_id, true)}"` })
      }
      if (end_seconds <= start_seconds) return err('end_seconds doit être > start_seconds')
      const range = byteRangeFor(rec, start_seconds, end_seconds)
      if (!range) return err('Taille ou durée inconnues pour cette pige, extraction impossible')
      const ext = rec.format ?? 'mp3'
      return json({
        ...base,
        clip: {
          startSeconds: start_seconds,
          endSeconds: end_seconds,
          rangeHeader: `bytes=${range.start}-${range.end}`,
          estimatedBytes: range.end - range.start + 1,
          curl: `curl -L -H "Range: bytes=${range.start}-${range.end}" -o extrait.${ext} "${url}"`,
          ffmpeg: `ffmpeg -ss ${fmtHms(start_seconds)} -to ${fmtHms(end_seconds)} -i "${url}" -c copy extrait.${ext}`
        }
      })
    }
  )

  server.registerTool(
    'download_clip',
    {
      title: 'Télécharger une pige ou un extrait en local',
      description:
        "Télécharge l'audio (pige entière, ou extrait start→end découpé par octets) dans un fichier sur la machine qui exécute ce serveur MCP, et retourne son chemin absolu — prêt pour un speech-to-text local. En transport HTTP distant, préférez get_clip_access.",
      inputSchema: {
        recording_id: z.number().int(),
        start_seconds: z.number().min(0).optional(),
        end_seconds: z.number().min(1).optional(),
        output_path: z.string().optional().describe('Chemin de sortie ; défaut : dossier temporaire')
      }
    },
    async ({ recording_id, start_seconds, end_seconds, output_path }) => {
      const rec = await api.recording(recording_id)
      const ext = rec.format ?? 'mp3'
      const isClip = start_seconds !== undefined && end_seconds !== undefined
      if (isClip && end_seconds! <= start_seconds!) return err('end_seconds doit être > start_seconds')

      const headers: Record<string, string> = {}
      if (isClip) {
        const range = byteRangeFor(rec, start_seconds!, end_seconds!)
        if (!range) return err('Taille ou durée inconnues pour cette pige, extraction impossible')
        headers.Range = `bytes=${range.start}-${range.end}`
      }

      const day = rec.startedAt.slice(0, 10)
      const defaultName = `${rec.radioSlug ?? 'radio'}_${day}_${parisHour(rec.startedAt)}h${
        isClip ? `_${Math.floor(start_seconds!)}s-${Math.floor(end_seconds!)}s` : ''
      }.${ext}`
      const outPath = output_path ?? join(tmpdir(), 'piges-radio', defaultName)

      await mkdir(join(outPath, '..'), { recursive: true })
      const res = await fetch(audioUrl(recording_id), { headers })
      if (!res.ok || !res.body) return err(`Téléchargement impossible (HTTP ${res.status})`)
      await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(outPath))
      const { size } = await stat(outPath)

      return json({
        path: outPath,
        sizeBytes: size,
        format: ext,
        radio: rec.radioSlug,
        startedAt: rec.startedAt,
        clip: isClip ? { startSeconds: start_seconds, endSeconds: end_seconds } : null,
        note: 'Fichier audio brut (découpe par octets, la 1re frame peut être tronquée — les décodeurs se resynchronisent).'
      })
    }
  )

  return server
}
