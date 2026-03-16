# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TaskToad is a multi-tenant SaaS project management MVP. The stack: React + Vite frontend, Express/TypeScript API with GraphQL (graphql-yoga), Prisma ORM with PostgreSQL, and HMAC JWT auth.

## Commands

### Development

```bash
# Start PostgreSQL (first time / if not running)
docker run -d --name tasktoad-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# Run DB migrations (first time or after schema changes)
cd apps/api && npx prisma migrate dev

pnpm dev       # Run both API and web together (recommended)
pnpm dev:api   # API only at http://localhost:3001/graphql (tsx watch)
pnpm dev:web   # Web only at http://localhost:5173 (Vite HMR)
```

### Build

```bash
pnpm build:order    # Build API only (use this for ordered builds)
pnpm build          # Build all packages
pnpm --filter api build   # Build API only
```

### Lint, Typecheck, Format

```bash
pnpm lint           # ESLint all packages
pnpm typecheck      # TypeScript check all packages
pnpm format         # Prettier format all
```

To run for a single package:
```bash
pnpm --filter api typecheck
pnpm --filter web lint
```

## Architecture

### Monorepo Structure

- `apps/api/` — Express API with graphql-yoga. GraphQL endpoint: `POST /graphql` (GraphiQL UI available in dev). Entry point: `src/index.ts`.
- `apps/web/` — React 18 + Vite + Tailwind. Vite proxies `/api/*` to `localhost:3001` in dev.

### GraphQL Schema

All operations require `Authorization: Bearer <token>` (except `signup` and `login`).

**Queries:**
- `me` — current user profile
- `projects` — list projects for the user's org
- `project(projectId)` — single project
- `tasks(projectId)` — tasks for a project

**Mutations:**
- `signup(email, password)` — create account
- `login(email, password)` — returns `{ token }`
- `createOrg(name)` — create org and attach user as `org:admin`
- `createProject(name)` — create project (`org:admin` only)
- `createTask(projectId, title, status?)` — create task
- `updateTask(taskId, title?, status?)` — update task

### Auth

- HMAC JWT (HS256) signed with `JWT_SECRET` env var (defaults to `'dev-secret'` in development)
- Token stored in `localStorage` under key `task-toad-id-token` (exported as `TOKEN_KEY` from `apps/web/src/api/client.ts`)
- Context built in `apps/api/src/graphql/context.ts` — verifies token, loads user from DB

### Key Files

- `apps/api/src/graphql/schema.ts` — GraphQL schema assembly (imports from `typedefs/`)
- `apps/api/src/graphql/typedefs/` — Domain-split GraphQL type definitions (auth, org, project, task, sprint, comment, notification, report, github, ai, search)
- `apps/api/src/graphql/resolvers/` — Domain-split resolvers (matching typedefs structure)
- `apps/api/src/graphql/context.ts` — `buildContext`, `JWT_SECRET`, `Context` type
- `apps/api/src/utils/encryption.ts` — AES-256-GCM encryption for API keys
- `apps/api/prisma/schema/` — Domain-split Prisma schema files (auth, org, project, task, sprint, comment, activity, notification, report, github, aiusage)
- `apps/api/src/routes/export.ts` — REST endpoints for project/activity CSV/JSON export
- `apps/web/src/api/client.ts` — `gql<T>()` fetch helper with AbortSignal support, `TOKEN_KEY`
- `apps/web/src/auth/context.tsx` — `AuthProvider`, `useAuth` hook
- `apps/web/src/hooks/useProjectData.ts` — data fetching, mutations, sprint/task CRUD, AI ops
- `apps/web/src/hooks/useTaskFiltering.ts` — search + filter logic
- `apps/web/src/hooks/useKeyboardShortcuts.ts` — keyboard shortcut handling
- `apps/web/src/utils/taskHelpers.ts` — `TASK_FIELDS`, status↔column mapping
- `apps/web/src/components/shared/` — reusable UI (SearchInput, FilterBar, Icons, Toast, etc.)
- `apps/web/src/components/Skeleton.tsx` — Loading skeleton components

### TypeScript Config

All packages extend `tsconfig.base.json`. Strict mode + `noUnusedLocals` + `noUnusedParameters` are enforced. Prefix unused variables with `_` to suppress the lint rule.

### Env Files

- `apps/api/.env` — `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_MASTER_KEY`, `CORS_ORIGINS`
- `apps/web/.env` — `VITE_API_URL` (set to `/api` in dev; Vite proxy handles routing)

Copy from `.env.example` and fill in values.

## Notes

- **No tests** are implemented in this MVP.
- Package manager is **pnpm**; do not use npm or yarn.
