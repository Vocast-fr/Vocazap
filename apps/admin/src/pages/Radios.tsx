import { useCallback, useEffect, useMemo, useState } from 'react'
import { RADIO_CATEGORIES, STREAM_TYPES, type RadioDTO } from '@vocazap/shared'
import { adminApi, UnauthorizedError } from '../api'

type CheckResult = Awaited<ReturnType<typeof adminApi.checkRadio>>

export default function RadiosPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [radios, setRadios] = useState<RadioDTO[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'down' | 'inactive'>('all')
  const [editing, setEditing] = useState<RadioDTO | 'new' | null>(null)
  const [checks, setChecks] = useState<Record<number, CheckResult | 'pending'>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRadios(await adminApi.radios())
      setError(null)
    } catch (e) {
      if (e instanceof UnauthorizedError) return onUnauthorized()
      setError((e as Error).message)
    }
  }, [onUnauthorized])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const nq = q.toLowerCase()
    return radios.filter((r) => {
      if (filter === 'down' && !['down', 'degraded'].includes(r.streamStatus)) return false
      if (filter === 'inactive' && r.active) return false
      return !nq || r.name.toLowerCase().includes(nq) || r.streamUrl.toLowerCase().includes(nq)
    })
  }, [radios, q, filter])

  const runCheck = async (r: RadioDTO) => {
    setChecks((c) => ({ ...c, [r.id]: 'pending' }))
    try {
      const res = await adminApi.checkRadio(r.id)
      setChecks((c) => ({ ...c, [r.id]: res }))
    } catch (e) {
      if (e instanceof UnauthorizedError) return onUnauthorized()
      setChecks((c) => ({ ...c, [r.id]: { ok: false, error: (e as Error).message, latencyMs: 0 } }))
    }
  }

  const toggleActive = async (r: RadioDTO) => {
    await adminApi.updateRadio(r.id, { active: !r.active }).catch((e) => setError((e as Error).message))
    void load()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (nom, URL)…"
          className="input w-64"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="input">
          <option value="all">Toutes ({radios.length})</option>
          <option value="down">En panne / dégradées</option>
          <option value="inactive">Désactivées</option>
        </select>
        <button onClick={() => setEditing('new')} className="btn-primary ml-auto">
          + Ajouter une radio
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="p-3">Radio</th>
              <th className="p-3">Cat.</th>
              <th className="p-3">Type</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Test</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const check = checks[r.id]
              return (
                <tr key={r.id} className={`border-t border-zinc-800/60 ${!r.active ? 'opacity-50' : ''}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {r.logoUrl ? (
                        <img src={r.logoUrl} alt="" className="h-7 w-7 rounded bg-white object-contain" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-[10px]">
                          {r.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="max-w-xs truncate text-xs text-zinc-500" title={r.streamUrl}>
                          {r.streamUrl}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{r.category}</td>
                  <td className="p-3 uppercase">{r.streamType}</td>
                  <td className="p-3">
                    <span
                      className={
                        r.streamStatus === 'ok'
                          ? 'text-emerald-400'
                          : r.streamStatus === 'down'
                            ? 'text-red-400'
                            : r.streamStatus === 'degraded'
                              ? 'text-amber-400'
                              : 'text-zinc-500'
                      }
                      title={r.lastError ?? ''}
                    >
                      {r.streamStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    {check === 'pending' ? (
                      <span className="text-zinc-500">…</span>
                    ) : check ? (
                      <span className={check.ok ? 'text-emerald-400' : 'text-red-400'} title={check.error ?? check.contentType}>
                        {check.ok ? `OK ${check.latencyMs} ms` : `KO ${check.error?.slice(0, 40) ?? check.statusCode ?? ''}`}
                      </span>
                    ) : (
                      <button onClick={() => runCheck(r)} className="text-accent hover:underline">
                        tester
                      </button>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap p-3">
                    <button onClick={() => setEditing(r)} className="text-accent hover:underline">
                      éditer
                    </button>
                    <button onClick={() => toggleActive(r)} className="text-zinc-400 hover:underline">
                      {r.active ? 'désactiver' : 'activer'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <RadioForm
          radio={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
          onUnauthorized={onUnauthorized}
        />
      )}
    </div>
  )
}

function RadioForm({
  radio,
  onClose,
  onSaved,
  onUnauthorized
}: {
  radio: RadioDTO | null
  onClose: () => void
  onSaved: () => void
  onUnauthorized: () => void
}) {
  const [form, setForm] = useState({
    name: radio?.name ?? '',
    streamUrl: radio?.streamUrl ?? '',
    streamType: radio?.streamType ?? 'mp3',
    category: radio?.category ?? 'D',
    websiteUrl: radio?.websiteUrl ?? '',
    logoUrl: radio?.logoUrl ?? '',
    active: radio?.active ?? true
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const payload = {
      ...form,
      websiteUrl: form.websiteUrl || null,
      logoUrl: form.logoUrl || null
    }
    try {
      if (radio) await adminApi.updateRadio(radio.id, payload as Partial<RadioDTO>)
      else await adminApi.createRadio(payload as Partial<RadioDTO>)
      onSaved()
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized()
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!radio) return
    if (!confirm(`Supprimer définitivement ${radio.name} et toutes ses piges ?`)) return
    try {
      await adminApi.deleteRadio(radio.id)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
      >
        <h2 className="text-lg font-bold">{radio ? `Éditer ${radio.name}` : 'Nouvelle radio'}</h2>
        <label className="block text-sm">
          Nom
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required className="input mt-1 w-full" />
        </label>
        <label className="block text-sm">
          URL du flux
          <input
            value={form.streamUrl}
            onChange={(e) => set('streamUrl', e.target.value)}
            required
            type="url"
            className="input mt-1 w-full font-mono text-xs"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Type de flux
            <select value={form.streamType} onChange={(e) => set('streamType', e.target.value)} className="input mt-1 w-full">
              {STREAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Catégorie
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input mt-1 w-full">
              {Object.entries(RADIO_CATEGORIES).map(([k, label]) => (
                <option key={k} value={k}>
                  {k} — {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Site web
          <input value={form.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} type="url" className="input mt-1 w-full" />
        </label>
        <label className="block text-sm">
          Logo (URL)
          <input value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} type="url" className="input mt-1 w-full" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          Enregistrement actif
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          {radio && (
            <button type="button" onClick={remove} className="btn ml-auto text-red-400 hover:underline">
              Supprimer
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
