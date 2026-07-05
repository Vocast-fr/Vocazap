# Contexte de build = racine du monorepo
FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NODE_ENV=production
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --filter @vocazap/api... --prod --no-frozen-lockfile

COPY packages ./packages
COPY apps/api ./apps/api
COPY data ./data

EXPOSE 3000
CMD ["pnpm", "--filter", "@vocazap/api", "start"]
