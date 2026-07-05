import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('radio/:slug', 'routes/radio.tsx'),
  route('radio/:slug/:date/:hour', 'routes/player.tsx'),
  route('robots.txt', 'routes/robots.ts'),
  route('sitemap.xml', 'routes/sitemap.ts')
] satisfies RouteConfig
