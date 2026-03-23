# TaskToad

Multi-tenant SaaS project management MVP with AI-assisted planning. Org-scoped projects, sprints, kanban boards, AI-powered task breakdown and code generation, GitHub integration, real-time notifications (SSE), webhooks, automations, Slack integration, and Prometheus observability. RBAC: org:admin / org:member.

> **Beta note:** Project-level access control is org-level for beta — all org members can access all projects within their org. Project-level RBAC is planned for post-beta.

## Stack

- **API**: Express + graphql-yoga + Prisma (PostgreSQL) + HMAC JWT + helmet/cors/rate-limit
- **Web**: React 18 + Vite + Tailwind CSS
- **AI**: Anthropic Claude (AI-assisted task planning, sprint planning, auto-complete pipeline with code generation → PR creation → AI review, bug report parsing)

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
│   │       ├── graphql/       # schema.ts, context.ts, resolvers/, typedefs/
│   │       ├── actions/       # Action plan executors (generate_code, create_pr, review_pr, etc.)
│   │       ├── ai/            # AI service, prompt builder, response parser, types
│   │       ├── infrastructure/ # Event bus, job queue, action executor
│   │       └── utils/         # encryption, logger, metrics, sseManager
│   └── web/          # React + Vite + Tailwind
│       └── src/
│           ├── components/         # KanbanBoard, BacklogView, TaskDetailPanel, etc.
│           │   └── shared/         # SearchInput, FilterBar, Icons, ToastContainer
│           ├── hooks/              # useProjectData, useTaskFiltering, useKeyboardShortcuts, useToast
│           ├── utils/              # taskHelpers (status↔column mapping)
│           ├── pages/              # ProjectDetail, Projects, Home, etc.
│           ├── api/                # gql() fetch helper
│           └── auth/               # AuthProvider, useAuth
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
| `SENTRY_DSN` | Sentry error tracking DSN (optional) |
| `SMTP_HOST` | SMTP server host (optional — if unset, email links are printed to the console) |
| `SMTP_PORT` | SMTP port (default `587`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | Sender address (default `noreply@tasktoad.app`) |
| `APP_URL` | Public app URL used in email links (default `http://localhost:5173`) |

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
2. Check the API console for the verification link (or configure SMTP for real email) and verify your email
3. Create an organization and set your Anthropic API key in Settings
4. Create a project (optionally connect a GitHub repo)
5. Add tasks manually or use AI to generate a task plan
6. Use **Auto-Complete** on tasks with instructions — generates code, creates a PR, and runs AI review automatically
7. Create a sprint, plan it from the backlog, and track progress on the kanban board
8. Invite team members from Settings → Team (invite links are printed to the API console in dev)

## GraphQL API

All operations require `Authorization: Bearer <token>` except `signup` and `login`.

GraphiQL UI is available at `http://localhost:3001/graphql` in development.

**Key queries:** `me`, `projects`, `project(projectId)`, `tasks(projectId)`, `sprints(projectId)`, `orgUsers`, `orgInvites`, `notifications`, `githubInstallations`, `automationRules`, `webhookEndpoints`, `slackIntegrations`

**Key mutations:** `signup`, `login`, `createOrg`, `createProject`, `createTask`, `updateTask`, `createSprint`, `updateSprint`, `deleteSprint`, `generateTaskPlan`, `previewTaskPlan`, `commitTaskPlan`, `createPullRequestFromTask`, `connectGitHubRepo`, `createAutomationRule`, `createWebhookEndpoint`, `connectSlack`, `inviteOrgMember`, `acceptInvite`

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

HMAC JWT (HS256) signed with `JWT_SECRET`. Tokens delivered via HttpOnly cookies (`tt-access` 15-min, `tt-refresh` 7-day) with `Secure`/`SameSite=Strict` in production. CSRF protection via `X-Requested-With` header. Fallback `Authorization: Bearer <token>` header supported for API clients. Session expiry shows a modal prompting re-login.

## Security

- `helmet` for HTTP security headers
- `cors` with origin whitelist (`CORS_ORIGINS`)
- `express-rate-limit`: 10 req/min for signup/login, 5 req/min for password reset/email verification
- 1MB request body limit
- AI prompts sanitized with `<user_input>` delimiters
- AI responses validated with Zod schemas
- Org API keys encrypted with AES-256-GCM at rest
