# Contexte de build = racine du monorepo
FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NODE_ENV=production TZ=Europe/Paris
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg tzdata ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/recorder/package.json apps/recorder/
RUN pnpm install --filter @vocazap/recorder... --prod --no-frozen-lockfile

COPY packages ./packages
COPY apps/recorder ./apps/recorder

VOLUME /data/buffer
CMD ["pnpm", "--filter", "@vocazap/recorder", "start"]
