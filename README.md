# TaskToad

Multi-tenant SaaS project management MVP. Org-scoped projects, sprints, kanban boards, and AI-assisted task planning with RBAC (org:admin / org:member).

## Stack

- **API**: Express + graphql-yoga + Prisma (PostgreSQL) + HMAC JWT + helmet/cors/rate-limit
- **Web**: React 18 + Vite + Tailwind CSS
- **AI**: Anthropic Claude (task plan generation, sprint planning)

## Prerequisites

- **Node.js 20+**
- **pnpm** (`npm install -g pnpm`)
- **Docker** (for PostgreSQL)

## Repo structure

```
task-toad/
├── apps/
│   ├── api/          # Express + graphql-yoga API
│   │   ├── prisma/   # Schema + migrations
│   │   └── src/
│   │       ├── graphql/  # schema.ts, context.ts, ai.ts
│   │       └── utils/    # encryption.ts
│   └── web/          # React + Vite + Tailwind
│       └── src/
│           ├── components/  # KanbanBoard, BacklogView, TaskDetailPanel, etc.
│           ├── pages/       # ProjectDetail, Projects, Home, etc.
│           ├── api/         # gql() fetch helper
│           └── auth/        # AuthProvider, useAuth
├── .claude-knowledge/  # Architecture docs and decision log
├── CLAUDE.md
└── pnpm-workspace.yaml
```

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

Or manually if you prefer not to use Compose:

```bash
docker run -d --name tasktoad-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tasktoad \
  -p 5432:5432 \
  postgres:16
```

### 3. Configure environment

**API** (`apps/api/.env`):

```bash
cp apps/api/.env.example apps/api/.env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/tasktoad` |
| `JWT_SECRET` | Secret for HMAC JWT signing (any random string) |
| `ENCRYPTION_MASTER_KEY` | 32-byte hex key for AES-256-GCM (org API key encryption) |
| `CORS_ORIGINS` | Comma-separated allowed origins, e.g. `http://localhost:5173` |
| `ANTHROPIC_API_KEY` | Anthropic API key (required for AI features) |

**Web** (`apps/web/.env`):

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Value |
|---|---|
| `VITE_API_URL` | `/api` (Vite proxy routes to `localhost:3001`) |

### 4. Run migrations

```bash
cd apps/api && npx prisma migrate dev
```

### 5. Start dev servers

```bash
pnpm dev   # starts both API and web concurrently
```

Or separately:

```bash
pnpm dev:api   # API at http://localhost:3001/graphql (GraphiQL available)
pnpm dev:web   # Web at http://localhost:5173
```

## Usage

1. Open http://localhost:5173/signup and create an account
2. Create an organization
3. Create a project
4. Add tasks manually or use AI to generate a task plan
5. Create a sprint, plan it from the backlog, and track progress on the kanban board

## GraphQL API

All operations require `Authorization: Bearer <token>` except `signup` and `login`.

GraphiQL UI is available at `http://localhost:3001/graphql` in development.

**Key queries:** `me`, `projects`, `project(projectId)`, `tasks(projectId)`, `sprints(projectId)`, `orgUsers`

**Key mutations:** `signup`, `login`, `createOrg`, `createProject`, `createTask`, `updateTask`, `createSprint`, `updateSprint`, `deleteSprint`

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Run API + web together |
| `pnpm dev:api` | API only |
| `pnpm dev:web` | Web only |
| `pnpm build` | Build all packages |
| `pnpm lint` | ESLint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm format` | Prettier format all |

## Auth

HMAC JWT (HS256) signed with `JWT_SECRET`. Token stored in `localStorage` as `task-toad-id-token`. All GraphQL resolvers verify the token and load the user from the database on each request.

## Security

- `helmet` for HTTP security headers
- `cors` with origin whitelist (`CORS_ORIGINS`)
- `express-rate-limit`: 200 req/min global, 10 req/min for auth endpoints
- 1MB request body limit
- AI prompts sanitized with `<user_input>` delimiters
- AI responses validated with Zod schemas
- Org API keys encrypted with AES-256-GCM at rest
