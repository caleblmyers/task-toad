# Task Toad

**AI-native project management.** Describe what you want done — Task Toad plans it, generates the code, and creates the PRs.

Free and open source (AGPL-3.0). Self-hostable. BYOK (bring your own Anthropic API key).

<!-- TODO: Add screenshot/GIF here -->

## Features

**Core Project Management**
- Tasks, sprints, kanban boards, backlog, epics, releases
- Multiple assignees, labels, priorities, dependencies
- Custom fields, time tracking, saved views
- TQL (Task Query Language) for advanced search
- Automation rules (trigger → action)
- Webhooks for external integrations
- Real-time updates via Server-Sent Events
- CSV/JSON project export

**AI Pipeline**
- Natural language task planning — describe a feature, get a structured plan
- Hierarchical plan generation (epics → tasks → subtasks)
- **Auto-Complete**: generates code → creates PR → runs AI review, all from a task description
- **Project scaffolding**: create a new repo and scaffold a framework (Next.js, Vite, Express, FastAPI) with AI-generated boilerplate
- Sprint planning, trend analysis, project health reports
- Knowledge base for project context

**GitHub Integration**
- Connect repos, create PRs from tasks
- Sync tasks to GitHub issues
- AI-powered PR review

**Team Collaboration**
- Org-scoped multi-tenancy
- Invite-based team management
- Comments with @mentions and threaded replies
- Real-time notifications
- Activity tracking

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

### Self-Hosting with Docker

```bash
# Clone and configure
git clone https://github.com/caleblmyers/task-toad.git
cd task-toad
cp apps/api/.env.example .env

# Generate secrets
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)

# Build and run
docker compose --profile deploy up -d

# Run migrations
docker compose exec app sh -c "cd apps/api && npx prisma migrate deploy"
```

App is available at `http://localhost:3001`.

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
| `TASKTOAD_LICENSE` | No | Self-host override — enables all premium features for every org |
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

## Open Core

Task Toad uses an open core model. The core product is fully open source (AGPL-3.0).

Premium features (Slack integration, SLA tracking, approval workflows, scheduled automations, advanced permissions) are gated per-org by the `plan` field on the Org model (`"free"` or `"paid"`). Self-hosters can set the `TASKTOAD_LICENSE` env var to bypass per-org checks and enable all premium features.

See `apps/api/src/utils/license.ts` for the gating implementation and `apps/web/src/hooks/useLicenseFeatures.ts` for the frontend hook.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

[AGPL-3.0](LICENSE)
