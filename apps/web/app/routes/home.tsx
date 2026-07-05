import { useMemo, useState } from 'react'
import { useLoaderData } from 'react-router'
import { RADIO_CATEGORIES, type RadioCategory, type RadioDTO } from '@vocazap/shared'
import { api } from '../lib/api'
import RadioCard from '../components/RadioCard'

export async function loader() {
  const radios = await api.radios()
  return { radios }
}

export function meta() {
  return [
    { title: 'Les piges radio - Vocast' },
    {
      name: 'description',
      content:
        'La bibliothèque des piges des radios françaises : réécoutez heure par heure les radios nationales, locales et associatives des 30 derniers jours.'
    }
  ]
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export default function Home() {
  const { radios } = useLoaderData<typeof loader>()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<RadioCategory | null>(null)

  const filtered = useMemo(() => {
    const nq = norm(q)
    return radios.filter(
      (r: RadioDTO) => (!cat || r.category === cat) && (!nq || norm(r.name).includes(nq))
    )
  }, [radios, q, cat])

  const byCategory = useMemo(() => {
    const groups = new Map<RadioCategory, RadioDTO[]>()
    for (const r of filtered) {
      const list = groups.get(r.category) ?? []
      list.push(r)
      groups.set(r.category, list)
    }
    return groups
  }, [filtered])

  const order: RadioCategory[] = ['D', 'C', 'B', 'A']

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        Réécouter les radios françaises, <span className="text-accent">heure par heure</span>
      </h1>
      <p className="mt-1 text-zinc-400">
        {radios.length} radios enregistrées en continu. Choisissez une radio, un jour, une heure — écoutez,
        téléchargez, extrayez.
      </p>

      <div className="sticky top-[57px] z-30 -mx-4 mt-5 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une radio…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 outline-none placeholder:text-zinc-500 focus:border-accent sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCat(null)}
              className={`rounded-full px-3 py-1.5 text-sm ${!cat ? 'bg-accent font-medium text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
            >
              Toutes
            </button>
            {(Object.entries(RADIO_CATEGORIES) as [RadioCategory, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCat(cat === key ? null : key)}
                className={`rounded-full px-3 py-1.5 text-sm ${cat === key ? 'bg-accent font-medium text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
                title={label}
              >
                {key} · {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 && <p className="py-16 text-center text-zinc-500">Aucune radio ne correspond.</p>}

      {order.map((key) =>
        byCategory.has(key) ? (
          <section key={key} className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {RADIO_CATEGORIES[key]} <span className="text-zinc-600">({byCategory.get(key)!.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byCategory.get(key)!.map((r) => (
                <RadioCard key={r.id} radio={r} />
              ))}
            </div>
          </section>
        ) : null
      )}
    </div>
  )
}
