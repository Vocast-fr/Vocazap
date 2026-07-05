import { Link, useLoaderData, useRouteLoaderData, type LoaderFunctionArgs } from 'react-router'
import { api, audioUrl } from '../lib/api'
import { addDays, formatDateLong, parisHour, todayParis } from '../lib/format'
import { RadioLogo } from '../components/RadioCard'
import Player from '../components/Player'
import type { loader as rootLoader } from '../root'

export async function loader({ params }: LoaderFunctionArgs) {
  const { slug, date, hour } = params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date!) || !/^\d{2}$/.test(hour!)) {
    throw new Response('URL invalide', { status: 400 })
  }
  const h = Number(hour)
  const [radio, recs] = await Promise.all([api.radio(slug!), api.recordings({ radio: slug!, date, pageSize: 48 })])
  const recording = recs.items.find((r) => parisHour(r.startedAt) === h)
  if (!recording) throw new Response('Pas de pige pour cette heure', { status: 404 })
  const hasPrev = recs.items.some((r) => parisHour(r.startedAt) === h - 1)
  const hasNext = recs.items.some((r) => parisHour(r.startedAt) === h + 1)
  return { radio, recording, date: date!, hour: h, hasPrev, hasNext }
}

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  if (!data) return [{ title: 'Pige introuvable — Les piges radio - Vocast' }]
  const { radio, date, hour } = data
  return [
    { title: `${radio.name} — ${date} ${hour}h — Les piges radio - Vocast` },
    {
      name: 'description',
      content: `Pige de ${radio.name} le ${formatDateLong(date)} de ${hour}h à ${hour + 1}h : écoute en ligne, téléchargement et extraction d'extraits.`
    }
  ]
}

export default function PlayerPage() {
  const { radio, recording, date, hour, hasPrev, hasNext } = useLoaderData<typeof loader>()
  const rootData = useRouteLoaderData<typeof rootLoader>('root')
  const apiBase = rootData?.ENV.PUBLIC_API_URL ?? ''

  const src = audioUrl(apiBase, recording.id)
  const dl = audioUrl(apiBase, recording.id, true)
  const clipBaseName = `${radio.slug}_${date}_${String(hour).padStart(2, '0')}h`

  const prevLink =
    hour > 0
      ? `/radio/${radio.slug}/${date}/${String(hour - 1).padStart(2, '0')}`
      : `/radio/${radio.slug}/${addDays(date, -1)}/23`
  const nextLink =
    hour < 23
      ? `/radio/${radio.slug}/${date}/${String(hour + 1).padStart(2, '0')}`
      : `/radio/${radio.slug}/${addDays(date, 1)}/00`

  return (
    <div className="mx-auto max-w-3xl">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link to="/" className="hover:text-accent">
          Radios
        </Link>{' '}
        /{' '}
        <Link to={`/radio/${radio.slug}?date=${date}`} className="hover:text-accent">
          {radio.name}
        </Link>{' '}
        / <span className="text-zinc-300 capitalize">{formatDateLong(date)}</span>
      </nav>

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RadioLogo radio={radio} className="h-14 w-14" />
          <div>
            <h1 className="text-xl font-bold leading-tight">{radio.name}</h1>
            <p className="text-sm capitalize text-zinc-400">
              {formatDateLong(date)} · <span className="font-medium text-accent">{hour}h → {hour + 1}h</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={prevLink}
            prefetch="intent"
            className={`rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:border-zinc-600 ${!hasPrev && hour > 0 ? 'opacity-50' : ''}`}
            title="Heure précédente"
          >
            ← {hour > 0 ? `${hour - 1}h` : 'veille 23h'}
          </Link>
          <Link
            to={nextLink}
            prefetch="intent"
            className={`rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:border-zinc-600 ${!hasNext && hour < 23 ? 'opacity-50' : ''}`}
            title="Heure suivante"
          >
            {hour < 23 ? `${hour + 1}h` : 'lendemain 0h'} →
          </Link>
        </div>
      </div>

      <Player
        key={recording.id}
        radio={radio}
        recording={recording}
        audioSrc={src}
        downloadUrl={dl}
        clipBaseName={clipBaseName}
      />

      {(recording.completeness ?? 1) < 0.97 && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          ⚠ Cette pige est partielle ({Math.round((recording.completeness ?? 0) * 100)} % de l'heure) : le flux a
          été interrompu pendant l'enregistrement. {recording.partsCount && recording.partsCount > 1 ? `Elle a été reconstituée à partir de ${recording.partsCount} segments.` : ''}
        </p>
      )}
    </div>
  )
}
