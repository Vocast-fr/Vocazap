/**
 * Scraper de https://fluxradios.blogspot.com/p/flux-radios-francaise.html
 *
 * À lancer EN LOCAL (le domaine peut être bloqué dans certains environnements) :
 *   pnpm scrape:radios
 *
 * Produit data/radios.scraped.json : à relire/corriger puis fusionner dans
 * data/radios.json (le seed upsert par slug, on peut relancer sans risque).
 *
 * Sans dépendance externe : parsing HTML par regex, volontairement permissif.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = 'https://fluxradios.blogspot.com/p/flux-radios-francaise.html'

type Category = 'A' | 'B' | 'C' | 'D'

interface Scraped {
  name: string
  streamUrl: string
  streamType: 'mp3' | 'aac' | 'hls'
  category: Category
  section: string
}

/** Devine la catégorie à partir du titre de section de la page. */
function categoryForSection(section: string): Category {
  const s = section.toLowerCase()
  if (s.includes('associative')) return 'A'
  if (s.includes('nationale')) return 'D'
  if (s.includes('réseau') || s.includes('reseau')) return 'C'
  return 'B'
}

function streamTypeFor(url: string): Scraped['streamType'] {
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls'
  if (/aac|adts/i.test(url)) return 'aac'
  return 'mp3'
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/g, ' ')
}

async function main() {
  const res = await fetch(PAGE, { headers: { 'user-agent': 'Mozilla/5.0 (VocastPiges scraper)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${PAGE}`)
  const html = await res.text()

  const radios: Scraped[] = []
  let currentSection = 'Nationales'

  // On découpe le HTML en blocs de ligne et on suit les titres de section
  const blocks = html.split(/<br\s*\/?>(?![^<]*<\/a>)|<\/p>|<\/div>|<\/h[1-6]>/i)

  for (const rawBlock of blocks) {
    const headingMatch = rawBlock.match(/<(?:h[1-6]|b|strong)[^>]*>([^<]{3,80})<\/(?:h[1-6]|b|strong)>/i)
    const text = decodeEntities(rawBlock.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

    const links = [...rawBlock.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
      .map((m) => decodeEntities(m[1]!))
      .filter((url) =>
        /\.(mp3|aac|m3u8)(\?|$)|icecast|shoutcast|streaming|stream|listen|radio|audio|\.fm[:/]|:\d{2,5}\//i.test(url)
      )
      .filter((url) => !/blogspot|blogger|facebook|twitter|youtube|wikipedia|\.(html?|php|png|jpe?g|gif)(\?|$)/i.test(url))

    if (headingMatch && links.length === 0) {
      currentSection = decodeEntities(headingMatch[1]!).trim()
      continue
    }

    if (!links.length) continue
    // Le nom = le texte du bloc avant le premier lien, sinon le texte entier
    const name = text.split(/https?:\/\//)[0]?.replace(/[:\-–|]+\s*$/, '').trim() ?? ''
    if (name.length < 2 || name.length > 60) continue

    const url = links[0]!
    radios.push({
      name,
      streamUrl: url,
      streamType: streamTypeFor(url),
      category: categoryForSection(currentSection),
      section: currentSection
    })
  }

  // Dédoublonnage par nom
  const seen = new Set<string>()
  const unique = radios.filter((r) => {
    const key = r.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const out = join(import.meta.dirname, '..', 'data', 'radios.scraped.json')
  writeFileSync(out, JSON.stringify(unique, null, 2))
  console.log(`✅ ${unique.length} radios extraites -> ${out}`)
  console.log('   Relisez le fichier, corrigez noms/catégories, puis fusionnez dans data/radios.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
