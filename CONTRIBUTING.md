# Contributing to Task Toad

Thanks for your interest in contributing! Task Toad is an open source AI-native project management tool licensed under AGPL-3.0.

## Getting Started

### Prerequisites

- **Node.js 20+**
- **pnpm** (`npm install -g pnpm`)
- **Docker** (for PostgreSQL)

### Setup

```bash
# Clone the repo
git clone https://github.com/caleblmyers/task-toad.git
cd task-toad

# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up -d

# Copy and configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Generate required secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output into ENCRYPTION_MASTER_KEY in apps/api/.env
# Also set JWT_SECRET to any random string

# Run database migrations
cd apps/api && npx prisma migrate dev && cd ../..

# Start dev servers
pnpm dev
```

The API runs at `http://localhost:3001/graphql` (GraphiQL UI available) and the web app at `http://localhost:5173`.

## Development

### Project Structure

```
task-toad/
├── apps/api/          # Express + graphql-yoga + Prisma
│   ├── prisma/schema/ # Domain-split Prisma schema files
│   └── src/
│       ├── graphql/   # Schema, resolvers, typedefs, context
│       ├── actions/   # Auto-complete pipeline executors
│       ├── ai/        # AI service, prompt builder, types
│       └── utils/     # Encryption, logging, metrics, SSE
├── apps/web/          # React 18 + Vite + Tailwind
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       └── api/       # GraphQL client
└── packages/shared-types/
```

### Commands

```bash
pnpm dev          # Run API + web together
pnpm test         # Run all tests (Vitest)
pnpm typecheck    # TypeScript strict mode check
pnpm lint         # ESLint
pnpm build        # Production build
pnpm format       # Prettier
```

### Code Style

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- Prefix unused variables with `_`
- **pnpm** only — do not use npm or yarn
- **Conventional Commits**: `feat(scope):`, `fix(scope):`, `chore(scope):`
- Prisma schema files are domain-split in `prisma/schema/`
- GraphQL typedefs and resolvers are domain-split in `typedefs/` and `resolvers/`

### Testing

```bash
pnpm test                    # All tests
pnpm --filter api test       # API unit tests
pnpm --filter web test       # Web component tests
```

Tests use Vitest. API integration tests require a running PostgreSQL instance.

## Making Changes

### Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes — keep PRs focused on a single concern
3. Ensure all checks pass: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
4. Write a clear PR description explaining what and why
5. Submit the PR — a maintainer will review it

### What Makes a Good PR

- **Focused**: One feature, one bug fix, or one refactor per PR
- **Tested**: Add tests for new functionality; ensure existing tests pass
- **Typed**: No `any` types; leverage TypeScript's type system
- **Documented**: Update relevant docs if you change behavior

### Areas Where Help Is Welcome

- Bug reports and fixes
- Documentation improvements
- Test coverage
- Accessibility improvements
- Performance optimizations
- New automation rule action types

## Architecture Notes

- **GraphQL**: All data access goes through `POST /graphql`. Use GraphiQL at `localhost:3001/graphql` to explore.
- **Auth**: HttpOnly cookies with HMAC JWT. Access token (15 min) + refresh token (7 day).
- **Real-time**: Server-Sent Events (SSE) for live updates — not WebSockets.
- **AI**: Anthropic Claude via `@anthropic-ai/sdk`. Users provide their own API key (BYOK).
- **License system**: Premium features are gated behind `TASKTOAD_LICENSE` env var. See `apps/api/src/utils/license.ts`.

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license.
