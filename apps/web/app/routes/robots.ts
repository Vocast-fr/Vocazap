export function loader() {
  const base = process.env.PUBLIC_WEB_URL ?? 'https://piges.vocast.fr'
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain' }
  })
}
