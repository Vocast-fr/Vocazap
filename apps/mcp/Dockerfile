# Contexte de build = racine du monorepo
FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NODE_ENV=production MCP_TRANSPORT=http
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/mcp/package.json apps/mcp/
RUN pnpm install --filter @vocazap/mcp... --prod --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/mcp ./apps/mcp

EXPOSE 3003
CMD ["pnpm", "--filter", "@vocazap/mcp", "start"]
