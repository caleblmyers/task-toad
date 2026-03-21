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

### Test

```bash
pnpm test       # Run Vitest across all packages
pnpm --filter api test   # API tests only
pnpm --filter web test   # Web tests only
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

### REST Endpoints

- `GET /api/health` — Health check (database connectivity, uptime, version/commit SHA, timestamp)
- `GET /api/metrics` — Prometheus metrics (prom-client)
- `GET /api/docs` — API documentation page
- `GET /api/export/project/:projectId/{json,csv}` — Project data export
- `GET /api/export/project/:projectId/activity/{json,csv}` — Activity audit log export

### Observability

- **Metrics:** Prometheus via prom-client — HTTP request duration/count, GraphQL resolver duration, Prisma connection pool gauges. Served at `/api/metrics`.
- **Logging:** Structured JSON logging via pino. Level configurable with `LOG_LEVEL` env var. Request logging via pino-http middleware.
- **Prisma metrics:** `metrics` preview feature enabled in Prisma schema for pool monitoring.

### Action Plan Pipeline

Tasks with instructions can be auto-completed via the **Auto-Complete** button, which generates an action plan and executes it step-by-step via a job queue.

- **Action types:** `generate_code`, `create_pr`, `review_pr`, `write_docs`, `manual_step`
- **Pipeline flow (GitHub-connected projects):** `generate_code` → `create_pr` → `review_pr` → task status transitions to `in_review`
- **Executors:** `apps/api/src/actions/executors/` — one file per action type
- **Registry:** `apps/api/src/actions/registry.ts` — maps action types to executors
- **Job executor:** `apps/api/src/infrastructure/jobs/actionExecutor.ts` — processes actions sequentially, handles budget checks, emits SSE events
- **Event bus:** `apps/api/src/infrastructure/eventbus/` — typed domain events for real-time updates
- **AI planner:** `promptBuilder.ts:buildActionPlanPrompt()` generates the action sequence; validated by `ActionPlanResponseSchema` in `aiTypes.ts`
- **Frontend:** `ActionProgressPanel.tsx` shows live progress; `ActionPlanDialog.tsx` for plan preview/approval; SSE events refresh state in real-time
- **Manual code generation is deprecated** — the standalone "Generate code" button has been removed from the UI. Auto-Complete is the sole code generation entry point. Backend mutations (`generateCodeFromTask`, `regenerateCodeFile`) still exist but are unused by the frontend.

### Real-Time

- **SSE:** Server-Sent Events via fetch-based client (not native `EventSource`) for real-time notifications and action plan progress. API: `apps/api/src/utils/sseManager.ts`. Client: `apps/web/src/hooks/useEventSource.ts`.
- **SSE events:** `task.created`, `task.updated`, `tasks.bulk_updated`, `task.action_completed`, `task.action_plan_completed`, `sprint.created`, `sprint.updated`, `sprint.closed`

### Multiple Assignees

- Tasks support multiple assignees via `TaskAssignee` join table (task.prisma)
- Mutations: `addTaskAssignee`, `removeTaskAssignee`
- DataLoader: `taskAssignees` in `loaders.ts` for batched loading

### GraphQL Schema

All operations require `Authorization: Bearer <token>` (except `signup` and `login`).

**Queries:**
- **Auth:** `me`, `orgInvites`
- **Org:** `org`, `orgUsers`
- **Project:** `projects`, `project(projectId)`, `projectStats`, `portfolioOverview`, `savedFilters`
- **Task:** `tasks(projectId)`, `epics`, `labels`, `customFields`
- **Sprint:** `sprints(projectId)`, `sprintVelocity`, `sprintBurndown`, `sprintForecast`, `workloadHeatmap`
- **Comment:** `comments`, `activities`
- **AI:** `aiUsage`, `aiPromptHistory`, `analyzeTrends`, `analyzeSprintTransition`, `projectChat`, `analyzeRepoDrift`, `previewHierarchicalPlan`, `taskInsights`, `projectActionPlans`
- **Notification:** `notifications`, `unreadNotificationCount`, `notificationPreferences`
- **GitHub:** `githubInstallations`, `githubInstallationRepos`, `githubProjectRepo`, `fetchRepoFileContent`
- **KnowledgeBase:** `knowledgeEntries(projectId)`
- **Report:** `reports`, `generateStandupReport`, `generateSprintReport`, `analyzeProjectHealth`, `extractTasksFromNotes`, `releaseBurndown`
- **Search:** `globalSearch`
- **ProjectRole:** `projectMembers`, `automationRules`
- **SLA:** `slaPolicies`, `taskSLAStatus`
- **Approval:** `pendingApprovals`, `taskApprovals`
- **Timesheet:** `timesheetData`
- **Initiative:** `initiatives`, `initiative`, `initiativeSummary`
- **FieldPermission:** `fieldPermissions`
- **Webhook:** `webhookEndpoints`, `webhookDeliveries`
- **Slack:** `slackIntegrations`, `slackUserMappings`

**Mutations:**
- **Auth:** `signup`, `login`, `sendVerificationEmail`, `verifyEmail`, `requestPasswordReset`, `resetPassword`, `updateProfile`, `inviteOrgMember`, `acceptInvite`, `revokeInvite`
- **Org:** `createOrg`, `setOrgApiKey`, `setAIBudget`
- **Project:** `createProject`, `updateProject`, `archiveProject`, `generateProjectOptions`, `createProjectFromOption`, `saveFilter`, `updateFilter`, `deleteFilter`
- **Task:** `createTask`, `updateTask`, `createSubtask`, `bulkUpdateTasks`, `createLabel`, `deleteLabel`, `addTaskLabel`, `removeTaskLabel`, `generateTaskPlan`, `previewTaskPlan`, `commitTaskPlan`, `expandTask`, `generateTaskInstructions`, `createCustomField`, `updateCustomField`, `deleteCustomField`, `setCustomFieldValue`, `addTaskAssignee`, `removeTaskAssignee`
- **Sprint:** `createSprint`, `updateSprint`, `deleteSprint`, `closeSprint`, `previewSprintPlan`, `commitSprintPlan`
- **Comment:** `createComment`, `updateComment`, `deleteComment`
- **AI:** `generateCodeFromTask`, `regenerateCodeFile`, `reviewPullRequest`, `parseBugReport`, `previewPRDBreakdown`, `commitPRDBreakdown`, `bootstrapProjectFromRepo`, `batchGenerateCode`, `generateOnboardingQuestions`, `saveOnboardingAnswers`, `commitHierarchicalPlan`, `dismissInsight`, `cancelActionPlan`, `generateManualTaskSpec`, `autoStartProject`
- **Notification:** `markNotificationRead`, `markAllNotificationsRead`, `updateNotificationPreference`
- **GitHub:** `linkGitHubInstallation`, `connectGitHubRepo`, `disconnectGitHubRepo`, `createGitHubRepo`, `createPullRequestFromTask`, `syncTaskToGitHub`, `decomposeGitHubIssue`, `generateFixFromReview`
- **Report:** `saveReport`, `deleteReport`, `summarizeProject`
- **ProjectRole:** `addProjectMember`, `removeProjectMember`, `updateProjectMemberRole`, `createAutomationRule`, `updateAutomationRule`, `deleteAutomationRule`
- **SLA:** `createSLAPolicy`, `updateSLAPolicy`, `deleteSLAPolicy`
- **Approval:** `approveTransition`, `rejectTransition`
- **Initiative:** `createInitiative`, `updateInitiative`, `deleteInitiative`, `addProjectToInitiative`, `removeProjectFromInitiative`
- **FieldPermission:** `setFieldPermission`, `deleteFieldPermission`
- **Webhook:** `createWebhookEndpoint`, `updateWebhookEndpoint`, `deleteWebhookEndpoint`, `testWebhookEndpoint`, `replayWebhookDelivery`
- **KnowledgeBase:** `createKnowledgeEntry`, `updateKnowledgeEntry`, `deleteKnowledgeEntry`
- **Slack:** `connectSlack`, `updateSlackIntegration`, `disconnectSlack`, `testSlackIntegration`, `mapSlackUser`, `unmapSlackUser`

### Auth

- HMAC JWT (HS256) signed with `JWT_SECRET` env var (defaults to `'dev-secret'` in development)
- Tokens delivered via HttpOnly cookies (`access_token` 15-min, `refresh_token` 7-day) — `Secure`/`SameSite=Strict` in production
- CSRF protection: `POST /graphql` requires `X-Requested-With` header; `POST /api/auth/refresh` for token rotation
- Fallback: `Authorization: Bearer <token>` header still supported for API clients
- Context built in `apps/api/src/graphql/context.ts` — reads cookie or header, verifies token, loads user from DB
- Sensitive ops (e.g., `setOrgApiKey`) require `confirmPassword` for re-authentication

### Key Files

- `apps/api/src/graphql/schema.ts` — GraphQL schema assembly (imports from `typedefs/`)
- `apps/api/src/graphql/typedefs/` — Domain-split GraphQL type definitions (auth, org, project, task, sprint, comment, notification, report, github, ai, search, slack, webhook, projectrole)
- `apps/api/src/graphql/resolvers/` — Domain-split resolvers (matching typedefs structure)
- `apps/api/src/graphql/context.ts` — `buildContext`, `JWT_SECRET`, `Context` type
- `apps/api/src/graphql/loaders.ts` — DataLoader instances for batching N+1 queries (task, project, sprint, user, labels, assignees, etc.)
- `apps/api/src/utils/encryption.ts` — AES-256-GCM encryption for API keys
- `apps/api/src/utils/metrics.ts` — Prometheus metrics (prom-client): HTTP request duration/count, GraphQL resolver duration, Prisma pool gauges
- `apps/api/src/utils/logger.ts` — Structured logging (pino) with `LOG_LEVEL` env var
- `apps/api/src/utils/sseManager.ts` — Server-Sent Events manager for real-time notifications
- `apps/api/src/ai/knowledgeRetrieval.ts` — `retrieveRelevantKnowledge()` — AI-based KB entry selection for task context
- `apps/api/prisma/schema/` — Domain-split Prisma schema files (auth, org, project, projectrole, task, sprint, comment, activity, notification, report, github, aiusage, slack, webhook, knowledgebase)
- `apps/api/src/actions/` — Action plan executor registry and per-type executors (generateCode, createPR, reviewPR, writeDocs, manualStep)
- `apps/api/src/infrastructure/jobs/actionExecutor.ts` — Job handler that processes action plan steps sequentially
- `apps/api/src/infrastructure/eventbus/` — Typed domain event bus (task, sprint, action events)
- `apps/api/src/routes/export.ts` — REST endpoints for project/activity CSV/JSON export
- `apps/api/src/routes/docs.ts` — REST endpoint serving API documentation page
- `apps/api/vitest.config.ts` — API test configuration (Vitest)
- `apps/web/src/api/client.ts` — `gql<T>()` fetch helper with AbortSignal support, `TOKEN_KEY`
- `apps/web/src/auth/context.tsx` — `AuthProvider`, `useAuth` hook
- `apps/web/src/hooks/useProjectData.ts` — data fetching, mutations, sprint/task CRUD, AI ops
- `apps/web/src/hooks/useTaskFiltering.ts` — search + filter logic
- `apps/web/src/hooks/useKeyboardShortcuts.ts` — keyboard shortcut handling
- `apps/web/src/hooks/useEventSource.ts` — fetch-based SSE client for real-time notifications and action plan progress
- `apps/web/src/components/ActionProgressPanel.tsx` — Live action plan progress display with inline review results
- `apps/web/src/utils/taskHelpers.ts` — `TASK_FIELDS`, status↔column mapping
- `apps/web/src/components/shared/` — reusable UI (SearchInput, FilterBar, Icons, Toast, etc.)
- `apps/web/src/components/Skeleton.tsx` — Loading skeleton components
- `apps/web/vitest.config.ts` — Web test configuration (Vitest)

### TypeScript Config

All packages extend `tsconfig.base.json`. Strict mode + `noUnusedLocals` + `noUnusedParameters` are enforced. Prefix unused variables with `_` to suppress the lint rule.

### Env Files

- `apps/api/.env` — `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_MASTER_KEY`, `CORS_ORIGINS`, `LOG_LEVEL` (optional, defaults to `info`), `SENTRY_DSN` (optional), `AI_RATE_LIMIT_PER_HOUR` (optional, defaults to `60`), `MAX_SESSIONS_PER_USER` (optional, defaults to `5`), `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (optional — falls back to local disk storage if not set)
- `apps/web/.env` — `VITE_API_URL` (set to `/api` in dev; Vite proxy handles routing)

Copy from `.env.example` and fill in values.

## Notes

- **Tests:** Vitest is configured for both `apps/api` and `apps/web`. Run with `pnpm test`.
- Package manager is **pnpm**; do not use npm or yarn.
