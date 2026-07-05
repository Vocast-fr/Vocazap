import { api } from '../lib/api'

export async function loader() {
  const base = process.env.PUBLIC_WEB_URL ?? 'https://piges.vocast.fr'
  const radios = await api.radios().catch(() => [])
  const urls = [
    `<url><loc>${base}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...radios.map(
      (r) =>
        `<url><loc>${base}/radio/${r.slug}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`
    )
  ].join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  return new Response(xml, {
    headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' }
  })
}
