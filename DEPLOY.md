# Deploying TaskToad

## Prerequisites

- A [Railway](https://railway.app) account
- Your GitHub repository connected to Railway
- Environment variables configured (see below)

## Quick Start (Railway)

1. **Create a Railway project** — go to [railway.app/new](https://railway.app/new) and select "Deploy from GitHub repo"
2. **Add a PostgreSQL addon** — in your project, click "New" → "Database" → "PostgreSQL"
3. **Link the database** — Railway auto-sets `DATABASE_URL` when you add Postgres to the same project
4. **Configure environment variables** — see the reference below
5. **Deploy** — Railway picks up `railway.toml` and builds automatically on push to `main`

## Environment Variables

### Required (API)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Railway Postgres addon) |
| `JWT_SECRET` | Random secret for signing JWTs. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_MASTER_KEY` | 64-char hex string for AES-256 encryption. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | Set to `production` |
| `CORS_ORIGINS` | Comma-separated allowed origins (e.g. `https://tasktoad.app`) |

### Optional (API)

| Variable | Description |
|---|---|
| `PORT` | Auto-set by Railway, defaults to 3001 |
| `SMTP_HOST` | SMTP server for email notifications |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | Sender address (default: `noreply@tasktoad.app`) |
| `APP_URL` | Public URL of the frontend |
| `GITHUB_APP_ID` | GitHub App ID for integration |
| `GITHUB_PRIVATE_KEY` | GitHub App private key (PEM) |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook secret |

### Frontend

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL (e.g. `https://api.tasktoad.dev`) |
| `VITE_GITHUB_APP_SLUG` | GitHub App slug for install links |

## Database

Migrations run automatically on every deploy via the `startCommand` in `railway.toml`:

```
npx prisma migrate deploy
```

This applies any pending migrations without prompting. No manual database setup is needed after the initial Postgres addon is created.

## Frontend Deployment

The API is deployed via Railway. The frontend (React + Vite) can be deployed as a static site using any of these options:

- **Railway static site** — add a second service in the same project, set build command to `pnpm install && pnpm --filter web build`, publish directory to `apps/web/dist`
- **Vercel** — connect the repo, set root directory to `apps/web`, framework preset to Vite
- **Netlify** — connect the repo, set build command to `cd apps/web && pnpm build`, publish directory to `apps/web/dist`

Set `VITE_API_URL` to point to your deployed API service URL.

## Custom Domain

1. In Railway, go to your service → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed by Railway
4. Update `CORS_ORIGINS` to include the new domain

## Local Docker Testing

Build and run the API image locally:

```bash
docker build --target api -t tasktoad-api .
docker run -p 3001:3001 --env-file apps/api/.env tasktoad-api
```

This uses the multi-stage `Dockerfile` at the repo root, targeting the `api` stage.
