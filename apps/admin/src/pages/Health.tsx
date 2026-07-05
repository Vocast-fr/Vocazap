import { useCallback, useEffect, useState } from 'react'
import type { HealthSummaryDTO } from '@vocazap/shared'
import { adminApi, UnauthorizedError } from '../api'

export default function HealthPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [data, setData] = useState<HealthSummaryDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await adminApi.health())
      setError(null)
    } catch (e) {
      if (e instanceof UnauthorizedError) return onUnauthorized()
      setError((e as Error).message)
    }
  }, [onUnauthorized])

  useEffect(() => {
    void load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (error) return <p className="text-red-400">{error}</p>
  if (!data) return <p className="text-zinc-500">Chargement…</p>

  const problematic = data.coverage24h
    .filter((c) => c.uploaded < 22)
    .sort((a, b) => a.uploaded - b.uploaded)

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Radios actives" value={`${data.radiosActive}/${data.radiosTotal}`} />
        <Stat
          label="Flux en panne / dégradés"
          value={String(data.radiosDown.length)}
          tone={data.radiosDown.length ? 'bad' : 'good'}
        />
        <Stat
          label="Couverture < 22 h/24"
          value={String(problematic.length)}
          tone={problematic.length ? 'warn' : 'good'}
        />
        <Stat label="Événements 24 h" value={String(data.recentEvents.length)} />
      </section>

      {data.radiosDown.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-red-400">🔴 Flux à vérifier</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-left text-zinc-400">
                <tr>
                  <th className="p-3">Radio</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Échecs consécutifs</th>
                  <th className="p-3">Dernière erreur</th>
                </tr>
              </thead>
              <tbody>
                {data.radiosDown.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/60">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">
                      <span className={r.streamStatus === 'down' ? 'text-red-400' : 'text-amber-400'}>
                        {r.streamStatus}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">{r.consecutiveFailures}</td>
                    <td className="max-w-md truncate p-3 text-zinc-400" title={r.lastError ?? ''}>
                      {r.lastError ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Couverture des dernières 24 h</h2>
        {problematic.length === 0 ? (
          <p className="text-sm text-emerald-400">✅ Toutes les radios actives ont ≥ 22 piges sur 24 h.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {problematic.map((c) => (
              <div key={c.radioId} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
                <span className="truncate">{c.name}</span>
                <span className={`tabular-nums ${c.uploaded < 12 ? 'text-red-400' : 'text-amber-400'}`}>
                  {c.uploaded}/24
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Derniers événements (24 h)</h2>
        <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
          {data.recentEvents.length === 0 && <p className="text-zinc-500">Aucun événement.</p>}
          {data.recentEvents.map((e) => (
            <p key={e.id} className="font-mono text-xs">
              <span className="text-zinc-500">{new Date(e.at).toLocaleTimeString('fr-FR')}</span>{' '}
              <span
                className={
                  e.type === 'down' ? 'text-red-400' : e.type === 'up' ? 'text-emerald-400' : 'text-amber-400'
                }
              >
                [{e.type}]
              </span>{' '}
              <span className="font-medium">{e.radioName}</span>{' '}
              <span className="text-zinc-400">{e.message}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : tone === 'good' ? 'text-emerald-400' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}
