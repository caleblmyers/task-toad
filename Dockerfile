FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install all dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --prod=false

# Build shared-types first (dependency of both api and web)
FROM deps AS shared-build
COPY packages/shared-types/ packages/shared-types/
COPY tsconfig.base.json ./
RUN pnpm --filter @tasktoad/shared-types build

# Build API
FROM shared-build AS api-build
COPY apps/api/ apps/api/
RUN cd apps/api && npx prisma generate && cd ../.. && pnpm --filter api build

# Build Web
FROM shared-build AS web-build
COPY apps/web/ apps/web/
ARG VITE_API_URL=
ARG VITE_GITHUB_APP_SLUG=tasktoad
ARG VITE_STRIPE_PRO_MONTHLY_PRICE_ID=
ARG VITE_STRIPE_PRO_ANNUAL_PRICE_ID=
RUN pnpm --filter web build

# Production image — API serves both GraphQL and static web files
FROM api-build AS production
COPY --from=web-build /app/apps/web/dist apps/web/dist
COPY apps/api/prisma apps/api/prisma
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "apps/api/dist/index.js"]
