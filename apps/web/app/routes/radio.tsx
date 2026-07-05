import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router'
import type { RecordingDTO } from '@vocazap/shared'
import { api } from '../lib/api'
import { addDays, formatDateLong, formatDuration, parisHour, todayParis } from '../lib/format'
import { RadioLogo } from '../components/RadioCard'

export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') ?? todayParis()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Response('Date invalide', { status: 400 })
  const [radio, recs] = await Promise.all([
    api.radio(params.slug!),
    api.recordings({ radio: params.slug!, date, pageSize: 48 })
  ])
  return { radio, date, recordings: recs.items }
}

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  const name = data?.radio.name ?? 'Radio'
  return [
    { title: `Piges ${name} — Les piges radio - Vocast` },
    {
      name: 'description',
      content: `Réécoutez ${name} heure par heure : toutes les piges des 30 derniers jours, à écouter, télécharger ou découper en extraits.`
    }
  ]
}

export default function RadioPage() {
  const { radio, date, recordings } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const today = todayParis()
  const minDate = addDays(today, -30)

  const byHour = new Map<number, RecordingDTO>()
  for (const rec of recordings) byHour.set(parisHour(rec.startedAt), rec)

  const setDate = (d: string) => navigate(`/radio/${radio.slug}?date=${d}`, { preventScrollReset: true })

  return (
    <div>
      <nav className="mb-4 text-sm text-zinc-500">
        <Link to="/" className="hover:text-accent">
          Radios
        </Link>{' '}
        / <span className="text-zinc-300">{radio.name}</span>
      </nav>

      <div className="flex items-center gap-4">
        <RadioLogo radio={radio} className="h-16 w-16" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{radio.name}</h1>
          <p className="text-sm text-zinc-400">
            {radio.websiteUrl ? (
              <a href={radio.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
                {radio.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            ) : (
              'Pige heure par heure'
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setDate(addDays(date, -1))}
          disabled={date <= minDate}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 hover:border-zinc-600 disabled:opacity-40"
          aria-label="Jour précédent"
        >
          ←
        </button>
        <input
          type="date"
          value={date}
          min={minDate}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 outline-none focus:border-accent"
        />
        <button
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 hover:border-zinc-600 disabled:opacity-40"
          aria-label="Jour suivant"
        >
          →
        </button>
        <span className="font-medium capitalize text-zinc-300">{formatDateLong(date)}</span>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {Array.from({ length: 24 }, (_, h) => {
          const rec = byHour.get(h)
          if (!rec) {
            return (
              <div
                key={h}
                className="flex h-16 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800/70 text-zinc-600"
                title="Pas de pige pour cette heure"
              >
                <span className="text-sm">{h}h</span>
                <span className="text-[10px]">—</span>
              </div>
            )
          }
          const pct = Math.round((rec.completeness ?? 1) * 100)
          return (
            <Link
              key={h}
              to={`/radio/${radio.slug}/${date}/${String(h).padStart(2, '0')}`}
              prefetch="intent"
              className="group flex h-16 flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 transition hover:border-accent hover:bg-zinc-800"
              title={`${h}h — ${formatDuration(rec.durationSeconds ?? 0)} (${pct} % de l'heure)`}
            >
              <span className="font-semibold group-hover:text-accent">{h}h</span>
              <span className={`text-[10px] ${pct >= 97 ? 'text-emerald-400' : pct >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                {pct >= 97 ? '●' : `${pct} %`}
              </span>
            </Link>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        ● : heure complète — un pourcentage indique une pige partielle (coupure du flux). Les piges sont conservées 30
        jours.
      </p>
    </div>
  )
}
