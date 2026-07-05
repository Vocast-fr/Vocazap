import { Link } from 'react-router'
import type { RadioDTO } from '@vocazap/shared'

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-300',
  B: 'bg-sky-500/15 text-sky-300',
  C: 'bg-violet-500/15 text-violet-300',
  D: 'bg-rose-500/15 text-rose-300'
}

export function RadioLogo({ radio, className = 'h-12 w-12' }: { radio: RadioDTO; className?: string }) {
  const initials = radio.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return radio.logoUrl ? (
    <img
      src={radio.logoUrl}
      alt=""
      loading="lazy"
      className={`${className} shrink-0 rounded-xl bg-white object-contain p-0.5`}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
        e.currentTarget.nextElementSibling?.classList.remove('hidden')
      }}
    />
  ) : (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-sm font-bold text-accent`}
    >
      {initials}
    </div>
  )
}

export default function RadioCard({ radio }: { radio: RadioDTO }) {
  return (
    <Link
      to={`/radio/${radio.slug}`}
      prefetch="intent"
      className="group flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600 hover:bg-zinc-900"
    >
      <RadioLogo radio={radio} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium group-hover:text-accent">{radio.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[radio.category] ?? ''}`}>
            Cat. {radio.category}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${
              radio.streamStatus === 'ok'
                ? 'bg-emerald-400'
                : radio.streamStatus === 'down'
                  ? 'bg-red-500'
                  : radio.streamStatus === 'degraded'
                    ? 'bg-amber-400'
                    : 'bg-zinc-600'
            }`}
            title={`Flux : ${radio.streamStatus}`}
          />
        </div>
      </div>
      <span className="text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-accent">→</span>
    </Link>
  )
}
