# TaskToad

Multi-tenant SaaS Project Management MVP: React frontend, Node.js/TypeScript API, AWS (Cognito, API Gateway, Lambda, DynamoDB). Org-scoped projects and tasks with RBAC (org:admin / org:member).

## Prerequisites

- **Node.js 20+**
- **pnpm** (`npm install -g pnpm`)
- **AWS CLI** configured (`aws configure`)
- **Docker** (optional; for CDK asset bundling in some setups)

## Repo structure

```
task-toad/
├── apps/
│   ├── api/          # Express API (Lambda + local)
│   └── web/          # React + Vite + Tailwind
├── packages/
│   └── shared/       # Zod schemas + shared types
├── infra/            # AWS CDK (Cognito, DynamoDB, Lambda, API Gateway, S3, EventBridge)
├── package.json
└── pnpm-workspace.yaml
```

## Setup

**Quick order (first time):** 1) Install → 2) Build infra → 3) CDK bootstrap → 4) CDK deploy → 5) Copy `.env.example` to `.env` for api and web, fill in CDK outputs → 6) Run api and web (see below).

### 1. Install dependencies

From the repo root:

```bash
pnpm install
```

This also runs `prepare`, which builds the shared package so `@task-toad/shared` types are available. If you skip install or need to rebuild shared later:

```bash
pnpm --filter @task-toad/shared build
```

### 2. Build infra (required before any CDK commands)

The CDK app is TypeScript and must be compiled to `dist/` before bootstrap or deploy. From repo root:

```bash
pnpm --filter infra build
```

Or from the infra directory:

```bash
cd infra
pnpm build
```

### 3. Bootstrap CDK (once per AWS account/region)

```bash
cd infra
pnpm cdk bootstrap
```

### 4. Deploy the stack

```bash
cd infra
pnpm cdk deploy
```

Note the outputs: `UserPoolId`, `UserPoolClientId`, `ApiUrl`, `TableName`. You will need these for local dev env (next step).

### 5. Configure env for local dev

**API** (`apps/api/.env`):

```bash
cp apps/api/.env.example apps/api/.env
```

Set:

- `COGNITO_USER_POOL_ID` = CDK output `UserPoolId`
- `COGNITO_REGION` = your region (e.g. `us-east-1`)
- `TABLE_NAME` = CDK output `TableName`
- `AWS_REGION` = same as above

**Web** (`apps/web/.env`):

```bash
cp apps/web/.env.example apps/web/.env
```

Set:

- `VITE_API_URL` = `http://localhost:3001` (for local API) or `/api` if using Vite proxy
- `VITE_COGNITO_USER_POOL_ID` = CDK output `UserPoolId`
- `VITE_COGNITO_CLIENT_ID` = CDK output `UserPoolClientId`
- `VITE_AWS_REGION` = same region

### 6. Run locally

Terminal 1 – API (from repo root):

```bash
pnpm --filter api build
pnpm dev:api
# API at http://localhost:3001
```

If the api build fails with “Cannot find module '@task-toad/shared'”, run `pnpm --filter @task-toad/shared build` first.

Terminal 2 – Web:

```bash
pnpm dev:web
# App at http://localhost:5173
```

If using Vite proxy: set `VITE_API_URL=/api` in `apps/web/.env` so requests go to `http://localhost:5173/api/*` and Vite proxies to `http://localhost:3001`.

### 7. Create a test user and get JWT (Cognito)

**Option A – UI**

1. Open http://localhost:5173/signup
2. Sign up with email + password
3. Confirm email (Cognito sends a code; use AWS Console → Cognito → User pool → Users to set user as confirmed if not using email in dev)
4. Sign in at /login
5. On “Create organization”, enter a name and submit
6. You’re in the app as org admin; create projects (admin) and tasks (any member)

**Option B – AWS CLI**

```bash
# Create user (replace PoolId and email)
aws cognito-idp sign-up \
  --client-id <UserPoolClientId> \
  --username your@email.com \
  --password TempPass1! \
  --user-attributes Name=email,Value=your@email.com

# Confirm user (replace PoolId)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id <UserPoolId> \
  --username your@email.com

# Get tokens (replace PoolId, ClientId, email, password)
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <UserPoolClientId> \
  --auth-parameters USERNAME=your@email.com,PASSWORD=TempPass1!
```

Use the `IdToken` from the response as `Authorization: Bearer <IdToken>` for API calls.

**Create org (required before projects/tasks)**

```bash
curl -X POST http://localhost:3001/orgs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <IdToken>" \
  -d '{"name":"My Org"}'
```

Then set the user’s `custom:org_id` and `custom:role` in Cognito (e.g. via Console or AdminUpdateUserAttributes) so the next token includes them, or use the “Create organization” flow in the UI after first login.

**Create project (admin) and task**

```bash
# Create project (admin only)
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <IdToken>" \
  -d '{"name":"My Project"}'

# List projects
curl -H "Authorization: Bearer <IdToken>" http://localhost:3001/projects

# Create task (replace <projectId>)
curl -X POST http://localhost:3001/projects/<projectId>/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <IdToken>" \
  -d '{"title":"First task","status":"todo"}'

# List tasks
curl -H "Authorization: Bearer <IdToken>" http://localhost:3001/projects/<projectId>/tasks

# Update task (replace <taskId>)
curl -X PATCH http://localhost:3001/tasks/<taskId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <IdToken>" \
  -d '{"status":"in_progress"}'
```

## Scripts

| Script        | Description                |
|---------------|----------------------------|
| `pnpm build`  | Build all packages         |
| `pnpm lint`   | Lint all                   |
| `pnpm typecheck` | Type-check all          |
| `pnpm dev:web`| Run web dev server         |
| `pnpm dev:api`| Run API dev server         |
| `pnpm deploy` | Deploy CDK stack (from root) |

## Auth and multi-tenancy

- **Cognito**: JWT access/ID tokens. Custom attributes: `custom:org_id`, `custom:role` (e.g. `org:admin`, `org:member`).
- **API**: All endpoints require `Authorization: Bearer <token>`. JWT is verified against Cognito JWKS; `orgId` and `role` are taken from the token and used for tenant isolation and RBAC.
- **RBAC**: Only `org:admin` can create projects; all org members can create/edit tasks within their org.

## Data model (DynamoDB single table)

- **Table**: `PmAppTable` (PK, SK).
- **GSI1**: List projects by org (GSI1PK = `ORG#<orgId>`, GSI1SK = `PROJECT#<createdAt>#<projectId>`).
- **GSI2**: List tasks by project (GSI2PK = `ORG#<orgId>#PROJECT#<projectId>`, GSI2SK = `TASK#<createdAt>#<taskId>`).

## Placeholders (no UI)

- **S3**: Bucket created by CDK for future file storage.
- **EventBridge**: Bus `task-toad-events` for future events (e.g. TaskCreated, ProjectCreated).
