FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS api-build
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./
RUN pnpm --filter api build

FROM deps AS web-build
COPY apps/web/ apps/web/
COPY tsconfig.base.json ./
RUN pnpm --filter web build

FROM node:22-slim AS api
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod
COPY --from=api-build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
RUN cd apps/api && npx prisma generate
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
