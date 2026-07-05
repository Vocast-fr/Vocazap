import { useEffect, useState } from 'react'
import { getToken, setToken, adminApi, UnauthorizedError } from './api'
import RadiosPage from './pages/Radios'
import HealthPage from './pages/Health'

type Tab = 'health' | 'radios'

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()))
  const [tab, setTab] = useState<Tab>('health')

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between border-b border-zinc-800 py-4">
        <h1 className="font-bold">
          Admin <span className="text-zinc-500">·</span> <span className="text-accent">Les piges radio</span>
        </h1>
        <nav className="flex gap-2">
          <button onClick={() => setTab('health')} className={tab === 'health' ? 'btn-primary' : 'btn-ghost'}>
            Santé des flux
          </button>
          <button onClick={() => setTab('radios')} className={tab === 'radios' ? 'btn-primary' : 'btn-ghost'}>
            Radios
          </button>
          <button
            onClick={() => {
              setToken(null)
              setAuthed(false)
            }}
            className="btn-ghost"
          >
            Déconnexion
          </button>
        </nav>
      </header>
      <main className="pt-6">
        {tab === 'health' ? (
          <HealthPage onUnauthorized={() => setAuthed(false)} />
        ) : (
          <RadiosPage onUnauthorized={() => setAuthed(false)} />
        )}
      </main>
    </div>
  )
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { token } = await adminApi.login(password)
      setToken(token)
      onLogin()
    } catch (err) {
      setError(err instanceof UnauthorizedError ? 'Mot de passe incorrect' : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h1 className="text-lg font-bold">
          Admin · <span className="text-accent">Les piges radio</span>
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoFocus
          className="input mt-4 w-full"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={busy || !password} className="btn-primary mt-4 w-full disabled:opacity-50">
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}

export function useUnauthorizedGuard(onUnauthorized: () => void) {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof UnauthorizedError) onUnauthorized()
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [onUnauthorized])
}
