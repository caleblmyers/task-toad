# Task Toad

**Autopilot for software projects.** Describe what you want built — Task Toad breaks it down, sequences the work, and executes it.

BYOK (bring your own Anthropic API key).

<!-- TODO: Add screenshot/GIF here -->

## Features

**Autopilot Pipeline**
- Describe a goal in natural language → get a structured execution plan with dependency graph
- Hierarchical decomposition (epics → tasks → subtasks with dependencies)
- **Auto-Complete**: generates code → commits to branch → creates PR → runs AI review → monitors CI
- Context threading — completed task outputs feed into downstream tasks
- Auto-retry and re-planning on failure
- **Project scaffolding**: create a repo and scaffold a framework (Next.js, Vite, Express, FastAPI)
- Knowledge base for persistent project context

**GitHub Integration**
- Connect repos, create PRs from tasks
- Branch-based code generation (feature branches per task)
- AI-powered PR review
- CI monitoring and auto-fix

**Project Dashboard**
- Tasks, sprints, kanban boards, backlog, epics, releases
- Multiple assignees, labels, priorities, dependencies
- Real-time updates via Server-Sent Events
- Sprint planning, trend analysis, project health reports
- TQL (Task Query Language) for advanced search
- Automation rules, webhooks, CSV/JSON export

**Team Collaboration**
- Org-scoped multi-tenancy
- Invite-based team management
- Comments with @mentions and threaded replies
- Real-time notifications

## Quick Start

### Prerequisites

- **Node.js 20+**
- **pnpm** (`npm install -g pnpm`)
- **Docker** (for PostgreSQL)

### Development Setup

```bash
git clone https://github.com/caleblmyers/task-toad.git
cd task-toad
pnpm install

# Start PostgreSQL
docker compose up -d

# Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit apps/api/.env — set JWT_SECRET and ENCRYPTION_MASTER_KEY

# Run database migrations
cd apps/api && npx prisma migrate dev && cd ../..

# Start dev servers
pnpm dev
```

Open `http://localhost:5173` — sign up, create an org, set your Anthropic API key in Settings, and create a project.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | Express + graphql-yoga + Prisma (PostgreSQL) |
| **Web** | React 18 + Vite + Tailwind CSS |
| **AI** | Anthropic Claude (`@anthropic-ai/sdk`) |
| **Auth** | HMAC JWT (HS256) via HttpOnly cookies |
| **Real-time** | Server-Sent Events (SSE) |
| **Observability** | Prometheus metrics, Pino structured logging, Sentry |

## Environment Variables

**API** (`apps/api/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing (any random string) |
| `ENCRYPTION_MASTER_KEY` | Yes | 64-char hex key for AES-256-GCM encryption |
| `CORS_ORIGINS` | No | Allowed origins (default: `http://localhost:5173`) |
| `LOG_LEVEL` | No | `trace\|debug\|info\|warn\|error` (default: `info`) |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `GITHUB_CLIENT_ID` | No | GitHub App OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub App OAuth client secret |
| `SMTP_HOST` | No | SMTP server (if unset, email links logged to console) |
| `GITHUB_APP_ID` | No | GitHub App ID for repo integration |

**Web** (`apps/web/.env`):

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `/api` (Vite proxy routes to API in dev) |

## Project Structure

```
task-toad/
├── apps/
│   ├── api/                # Express + GraphQL API
│   │   ├── prisma/schema/  # Domain-split Prisma schema
│   │   └── src/
│   │       ├── graphql/    # Schema, resolvers, typedefs, context
│   │       ├── actions/    # Auto-complete pipeline executors
│   │       ├── ai/         # AI service, prompts, response parsing
│   │       └── utils/      # Encryption, logging, metrics, SSE, license
│   └── web/                # React + Vite + Tailwind
│       └── src/
│           ├── components/ # UI components
│           ├── hooks/      # Data fetching, filtering, shortcuts
│           ├── pages/      # Route pages
│           └── api/        # GraphQL client
├── packages/shared-types/  # Shared TypeScript types
├── CLAUDE.md               # AI assistant context (Claude Code)
└── CONTRIBUTING.md         # Contributor guide
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run API + web together |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm typecheck` | TypeScript strict mode check |
| `pnpm lint` | ESLint all packages |
| `pnpm build` | Production build |
| `pnpm format` | Prettier format |

## GraphQL API

GraphiQL UI is available at `http://localhost:3001/graphql` in development. All operations require authentication except `signup` and `login`.

See [CLAUDE.md](CLAUDE.md) for the full list of queries and mutations.

## Security

- HttpOnly cookies with short-lived access tokens (15 min) + refresh token rotation
- CSRF protection via `X-Requested-With` header
- `helmet` security headers + `cors` origin whitelist
- Rate limiting: 10/min auth, 5/min password reset
- AES-256-GCM encryption for API keys at rest
- AI prompt injection defense (`<user_input>` delimiters + Zod validation)
- Multi-tenant isolation with org-scoped queries

## Pricing

Task Toad is a closed-source SaaS with a free tier. Pricing splits on **orchestration depth**, not usage limits:

- **Free**: Manual task management + basic AI planning + single-agent execution. 1 project. BYOK.
- **Paid** ($15-25/month): Full autopilot pipeline — dependency-aware sequencing, parallel execution, context threading, auto-retry. Unlimited projects. Knowledge base.

Premium features are gated per-org by the `plan` field on the Org model. See `apps/api/src/utils/license.ts`.

## License

Proprietary. All rights reserved.
