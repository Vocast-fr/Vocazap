# Contexte de build = racine du monorepo
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --filter @vocazap/admin... --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin
RUN pnpm --filter @vocazap/admin build

FROM nginx:alpine
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY docker/admin-nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/admin-entrypoint.sh /docker-entrypoint.d/40-inject-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-config.sh
EXPOSE 80
