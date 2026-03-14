FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install all dependencies (dev + prod)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod=false

# Build API: generate Prisma client, then compile TypeScript
FROM deps AS api-build
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./
RUN cd apps/api && npx prisma generate && cd ../.. && pnpm --filter api build

# Build Web
FROM deps AS web-build
COPY apps/web/ apps/web/
COPY tsconfig.base.json ./
RUN pnpm --filter web build

# Production API image
# Uses the full deps stage (prisma CLI needed for migrate deploy at startup)
FROM api-build AS api
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
