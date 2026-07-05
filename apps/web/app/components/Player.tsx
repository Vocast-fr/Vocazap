import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RadioDTO, RecordingDTO } from '@vocazap/shared'
import { formatBytes, formatDuration, parseDuration } from '../lib/format'
import { downloadClip, estimateClipBytes } from '../lib/extract'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

interface PlayerProps {
  radio: RadioDTO
  recording: RecordingDTO
  audioSrc: string
  downloadUrl: string
  clipBaseName: string
}

export default function Player({ radio, recording, audioSrc, downloadUrl, clipBaseName }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(recording.durationSeconds ?? 3600)
  const [buffered, setBuffered] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [loading, setLoading] = useState(true)

  // --- Extraction ---
  const [extractMode, setExtractMode] = useState(false)
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(60)
  const [loopPreview, setLoopPreview] = useState(false)
  const [clipProgress, setClipProgress] = useState<number | null>(null)
  const [clipError, setClipError] = useState<string | null>(null)

  const storageKey = `pige-pos-${recording.id}`

  const seekTo = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(Math.max(0, t), audio.duration || duration)
  }, [duration])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }, [])

  // Événements audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      setTime(audio.currentTime)
      if (audio.buffered.length) setBuffered(audio.buffered.end(audio.buffered.length - 1))
      if (Math.floor(audio.currentTime) % 5 === 0) {
        localStorage.setItem(storageKey, String(audio.currentTime))
      }
    }
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
      setLoading(false)
      const saved = Number(localStorage.getItem(storageKey) ?? 0)
      if (saved > 5 && saved < audio.duration - 10) audio.currentTime = saved
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('waiting', () => setLoading(true))
    audio.addEventListener('canplay', () => setLoading(false))
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [storageKey])

  // Boucle de pré-écoute de l'extrait
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !extractMode || !loopPreview) return
    const onTime = () => {
      if (audio.currentTime >= clipEnd || audio.currentTime < clipStart - 1) {
        audio.currentTime = clipStart
      }
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [extractMode, loopPreview, clipStart, clipEnd])

  // Vitesse / volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Media Session (contrôles écran verrouillé mobile)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: clipBaseName.replaceAll('_', ' '),
      artist: radio.name,
      album: 'Les piges radio - Vocast',
      artwork: radio.logoUrl ? [{ src: radio.logoUrl, sizes: '512x512' }] : []
    })
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play())
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause())
    navigator.mediaSession.setActionHandler('seekbackward', () => seekTo((audioRef.current?.currentTime ?? 0) - 15))
    navigator.mediaSession.setActionHandler('seekforward', () => seekTo((audioRef.current?.currentTime ?? 0) + 15))
  }, [radio, clipBaseName, seekTo])

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') return
      const audio = audioRef.current
      if (!audio) return
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          seekTo(audio.currentTime - 15)
          break
        case 'ArrowRight':
          seekTo(audio.currentTime + 15)
          break
        case 'j':
          seekTo(audio.currentTime - 60)
          break
        case 'l':
          seekTo(audio.currentTime + 60)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume((v) => Math.min(1, v + 0.1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume((v) => Math.max(0, v - 0.1))
          break
        case 'i':
          if (extractMode) setClipStart(Math.min(audio.currentTime, clipEnd - 1))
          break
        case 'o':
          if (extractMode) setClipEnd(Math.max(audio.currentTime, clipStart + 1))
          break
        default:
          if (/^[0-9]$/.test(e.key)) seekTo((Number(e.key) / 10) * duration)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, seekTo, duration, extractMode, clipStart, clipEnd])

  const onDownloadClip = async () => {
    if (!recording.fileSize || clipEnd <= clipStart) return
    setClipError(null)
    setClipProgress(0)
    try {
      await downloadClip({
        audioUrl: audioSrc,
        fileSize: recording.fileSize,
        durationSeconds: duration,
        startSeconds: clipStart,
        endSeconds: clipEnd,
        fileName: `${clipBaseName}_${formatDuration(clipStart).replaceAll(':', '-')}_${formatDuration(clipEnd).replaceAll(':', '-')}.${recording.format ?? 'mp3'}`,
        onProgress: setClipProgress
      })
    } catch (e) {
      setClipError((e as Error).message)
    } finally {
      setClipProgress(null)
    }
  }

  const clipBytes = useMemo(
    () => (recording.fileSize ? estimateClipBytes(recording.fileSize, duration, clipEnd - clipStart) : null),
    [recording.fileSize, duration, clipStart, clipEnd]
  )

  const pct = (v: number) => `${(v / duration) * 100}%`

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl sm:p-6">
      <audio ref={audioRef} src={audioSrc} preload="metadata" crossOrigin="anonymous" />

      {/* Barre de progression */}
      <div className="relative h-4 select-none">
        <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-zinc-800" />
        <div className="absolute top-1.5 h-1 rounded-full bg-zinc-700" style={{ width: pct(buffered) }} />
        <div className="absolute top-1.5 h-1 rounded-full bg-accent" style={{ width: pct(time) }} />
        {extractMode && (
          <div
            className="absolute top-0 h-4 rounded bg-accent/20 ring-1 ring-accent/60"
            style={{ left: pct(clipStart), width: pct(Math.max(0, clipEnd - clipStart)) }}
          />
        )}
        <input
          type="range"
          className="seek absolute inset-x-0 top-0 h-4 w-full"
          min={0}
          max={duration}
          step={1}
          value={time}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Position de lecture"
        />
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-zinc-400">
        <span>{formatDuration(time)}</span>
        <span>{formatDuration(duration)}</span>
      </div>

      {/* Contrôles */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button onClick={() => seekTo(time - 60)} className="ctrl" title="Reculer d'1 min (J)">
          −1m
        </button>
        <button onClick={() => seekTo(time - 15)} className="ctrl" title="Reculer de 15 s (←)">
          −15s
        </button>
        <button
          onClick={togglePlay}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-zinc-950 shadow-lg transition hover:bg-accent-strong"
          title="Lecture / pause (espace)"
        >
          {loading && !playing ? '…' : playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => seekTo(time + 15)} className="ctrl" title="Avancer de 15 s (→)">
          +15s
        </button>
        <button onClick={() => seekTo(time + 60)} className="ctrl" title="Avancer d'1 min (L)">
          +1m
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-zinc-400">
          Vitesse
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                ×{s}
              </option>
            ))}
          </select>
        </label>
        <label className="hidden items-center gap-2 text-zinc-400 sm:flex">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="seek w-24"
          />
        </label>
        <a
          href={downloadUrl}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 transition hover:border-accent hover:text-accent"
        >
          ⬇ Télécharger l'heure {recording.fileSize ? `(${formatBytes(recording.fileSize)})` : ''}
        </a>
        <button
          onClick={() => {
            setExtractMode((m) => !m)
            if (!extractMode) {
              setClipStart(Math.floor(time))
              setClipEnd(Math.min(duration, Math.floor(time) + 60))
            }
          }}
          className={`rounded-lg px-3 py-1.5 transition ${
            extractMode
              ? 'bg-accent font-medium text-zinc-950'
              : 'border border-zinc-700 text-zinc-200 hover:border-accent hover:text-accent'
          }`}
        >
          ✂ Extraire un extrait
        </button>
      </div>

      {/* Panneau d'extraction */}
      {extractMode && (
        <div className="mt-5 rounded-2xl border border-accent/30 bg-zinc-950/60 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <ClipBound
              label="Début"
              value={clipStart}
              max={clipEnd - 1}
              onChange={(v) => setClipStart(Math.min(v, clipEnd - 1))}
              onAtPlayhead={() => setClipStart(Math.min(Math.floor(time), clipEnd - 1))}
            />
            <ClipBound
              label="Fin"
              value={clipEnd}
              max={duration}
              onChange={(v) => setClipEnd(Math.max(v, clipStart + 1))}
              onAtPlayhead={() => setClipEnd(Math.max(Math.floor(time), clipStart + 1))}
            />
            <div className="text-sm text-zinc-400">
              Durée : <span className="font-medium text-zinc-200">{formatDuration(clipEnd - clipStart)}</span>
              {clipBytes ? <span> · ≈ {formatBytes(clipBytes)}</span> : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                seekTo(clipStart)
                setLoopPreview(true)
                void audioRef.current?.play()
              }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
            >
              ▶ Pré-écouter la sélection
            </button>
            <label className="flex items-center gap-1.5 text-sm text-zinc-400">
              <input type="checkbox" checked={loopPreview} onChange={(e) => setLoopPreview(e.target.checked)} />
              en boucle
            </label>
            <button
              onClick={onDownloadClip}
              disabled={clipProgress !== null || !recording.fileSize}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-accent-strong disabled:opacity-50"
            >
              {clipProgress !== null ? `Téléchargement… ${Math.round(clipProgress * 100)} %` : "⬇ Télécharger l'extrait"}
            </button>
          </div>
          {clipError && <p className="mt-2 text-sm text-red-400">{clipError}</p>}
          <p className="mt-2 text-xs text-zinc-500">
            Raccourcis : <kbd>I</kbd> = début à la position courante, <kbd>O</kbd> = fin. Découpe sans ré-encodage,
            précision ≈ 1 s.
          </p>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-zinc-600">
        <kbd>espace</kbd> lecture · <kbd>←</kbd>/<kbd>→</kbd> ±15 s · <kbd>J</kbd>/<kbd>L</kbd> ±1 min ·{' '}
        <kbd>0-9</kbd> aller à 0-90 %
      </p>
    </div>
  )
}

function ClipBound({
  label,
  value,
  max,
  onChange,
  onAtPlayhead
}: {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
  onAtPlayhead: () => void
}) {
  const [text, setText] = useState(formatDuration(value))
  useEffect(() => setText(formatDuration(value)), [value])
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</label>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = parseDuration(text)
            if (parsed !== null) onChange(Math.min(parsed, max))
            else setText(formatDuration(value))
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-center tabular-nums outline-none focus:border-accent"
        />
        <button
          onClick={onAtPlayhead}
          className="rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:border-accent hover:text-accent"
          title="Utiliser la position de lecture courante"
        >
          ⌖ ici
        </button>
      </div>
    </div>
  )
}
