/**
 * Extraction d'un extrait côté client, sans ré-encodage : on télécharge la
 * plage d'octets correspondant à [start, end] (flux CBR mp3/aac : offset ≈
 * taille × temps / durée). Les décodeurs mp3/adts se resynchronisent sur la
 * première frame valide — précision de l'ordre de la seconde.
 */
export async function downloadClip(opts: {
  audioUrl: string
  fileSize: number
  durationSeconds: number
  startSeconds: number
  endSeconds: number
  fileName: string
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}): Promise<void> {
  const { audioUrl, fileSize, durationSeconds, startSeconds, endSeconds, fileName, onProgress, signal } = opts
  const bytesPerSecond = fileSize / durationSeconds
  // Petite marge amont pour retomber sur une frame complète
  const startByte = Math.max(0, Math.floor((startSeconds - 0.3) * bytesPerSecond))
  const endByte = Math.min(fileSize - 1, Math.ceil(endSeconds * bytesPerSecond))

  const res = await fetch(audioUrl, {
    headers: { Range: `bytes=${startByte}-${endByte}` },
    signal
  })
  if (!res.ok && res.status !== 206) throw new Error(`Téléchargement impossible (HTTP ${res.status})`)

  const total = endByte - startByte + 1
  const reader = res.body?.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress?.(Math.min(1, received / total))
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') ?? 'audio/mpeg' })
  triggerDownload(blob, fileName)
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function estimateClipBytes(fileSize: number, durationSeconds: number, clipSeconds: number): number {
  return Math.round((fileSize / durationSeconds) * clipSeconds)
}
