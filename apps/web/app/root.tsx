import { useEffect } from 'react'
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError
} from 'react-router'
import './app.css'

export function loader() {
  return {
    ENV: {
      PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? 'http://localhost:3000',
      PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3001'
    }
  }
}

export function meta() {
  return [
    { title: 'Les piges radio - Vocast' },
    {
      name: 'description',
      content:
        "Réécoutez heure par heure les piges des radios françaises : nationales, locales et associatives. Écoute, téléchargement et extraction d'extraits."
    },
    { name: 'theme-color', content: '#09090b' }
  ]
}

export function Layout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <img src="/icons/icon.svg" alt="" className="h-7 w-7" />
              <span>
                Les piges radio <span className="text-zinc-500">·</span>{' '}
                <span className="text-accent">Vocast</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6">{children}</main>
        <footer className="border-t border-zinc-800/80 py-6 text-center text-sm text-zinc-500">
          <p>
            Un projet <a href="https://vocast.fr" className="text-accent hover:underline">Vocast</a> — pour toute
            réclamation concernant une radio : contact@vocast.fr
          </p>
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary() {
  const error = useRouteError()
  const is404 = isRouteErrorResponse(error) && error.status === 404
  return (
    <div className="py-24 text-center">
      <p className="text-6xl">📻</p>
      <h1 className="mt-4 text-2xl font-bold">{is404 ? 'Page introuvable' : 'Une erreur est survenue'}</h1>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 font-medium text-zinc-950">
        Retour aux radios
      </Link>
    </div>
  )
}
