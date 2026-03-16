# TaskToad App Overview

## What It Is

Multi-tenant SaaS project management MVP. Users belong to orgs; orgs own projects; projects contain tasks.

## Auth Flow

1. User calls `signup(email, password)` or `login(email, password)` mutation
2. API returns a JWT signed with `JWT_SECRET` (HS256 via `jose`)
3. Web stores token in `localStorage` under key `task-toad-id-token` (exported as `TOKEN_KEY`)
4. Subsequent requests include `Authorization: Bearer <token>`
5. `apps/api/src/graphql/context.ts` verifies token, loads user from Postgres via Prisma

## Data Model (Prisma)

```
User              — id, email, passwordHash, orgId, role
Org               — id, name, anthropicApiKeyEncrypted
Project           — id, name, description, prompt, orgId, statuses?, customFields
Sprint            — id, name, orgId, projectId, isActive, columns (JSON string[]), startDate?, endDate?, closedAt?
Task              — id, title, status, projectId, orgId, parentTaskId?, sprintId?, sprintColumn?, assigneeId?
                    priority, estimatedHours, storyPoints, description, instructions, suggestedTools, dependsOn
TaskAssignee      — id, taskId, userId, assignedAt (join table for multiple assignees)
SlackUserMapping  — id, slackUserId, slackTeamId, userId, orgId (maps Slack users to TaskToad users)
WebhookEndpoint   — id, orgId, url, secret, events, isActive
WebhookDelivery   — id, endpointId, event, payload, status, statusCode, attemptCount, nextRetryAt
```

User roles tracked via a string field (e.g. `org:admin`). Only `org:admin` can `createProject`.

**Sprints:** A project can have multiple sprints; at most one is `isActive` at a time (enforced by `updateSprint` resolver). Tasks are assigned to a sprint via `sprintId` (null = backlog). `sprintColumn` tracks which kanban column the task is in within the sprint. `columns` on Sprint is a JSON array of column name strings, configurable per sprint.

## Request Path (dev)

```
Browser → Vite dev server (localhost:5173)
       → proxy /api/* → Express (localhost:3001)
       → graphql-yoga at POST /graphql
       → resolver → Prisma → PostgreSQL (Docker, port 5432)
```

## GraphQL Operations

**Public (no auth):** `signup`, `login`

**Authed queries:** `me`, `orgInvites`, `org`, `orgUsers`, `projects`, `project(projectId)`, `projectStats`, `portfolioOverview`, `savedFilters`, `tasks(projectId)`, `epics`, `labels`, `customFields`, `sprints(projectId)`, `sprintVelocity`, `sprintBurndown`, `comments`, `activities`, `aiUsage`, `aiPromptHistory`, `analyzeTrends`, `analyzeSprintTransition`, `projectChat`, `analyzeRepoDrift`, `notifications`, `unreadNotificationCount`, `notificationPreferences`, `githubInstallations`, `githubInstallationRepos`, `githubProjectRepo`, `fetchRepoFileContent`, `reports`, `generateStandupReport`, `generateSprintReport`, `analyzeProjectHealth`, `extractTasksFromNotes`, `globalSearch`, `projectMembers`, `automationRules`, `webhookEndpoints`, `webhookDeliveries`, `slackIntegrations`, `slackUserMappings`

**Authed mutations:** `createOrg`, `setOrgApiKey`, `setAIBudget`, `createProject`, `updateProject`, `archiveProject`, `generateProjectOptions`, `createProjectFromOption`, `saveFilter`, `updateFilter`, `deleteFilter`, `createTask`, `updateTask`, `createSubtask`, `bulkUpdateTasks`, `createLabel`, `deleteLabel`, `addTaskLabel`, `removeTaskLabel`, `generateTaskPlan`, `previewTaskPlan`, `commitTaskPlan`, `expandTask`, `generateTaskInstructions`, `createCustomField`, `updateCustomField`, `deleteCustomField`, `setCustomFieldValue`, `addTaskAssignee`, `removeTaskAssignee`, `createSprint`, `updateSprint`, `deleteSprint`, `closeSprint`, `previewSprintPlan`, `commitSprintPlan`, `createComment`, `updateComment`, `deleteComment`, `generateCodeFromTask`, `regenerateCodeFile`, `reviewPullRequest`, `parseBugReport`, `previewPRDBreakdown`, `commitPRDBreakdown`, `bootstrapProjectFromRepo`, `batchGenerateCode`, `markNotificationRead`, `markAllNotificationsRead`, `updateNotificationPreference`, `linkGitHubInstallation`, `connectGitHubRepo`, `disconnectGitHubRepo`, `createGitHubRepo`, `createPullRequestFromTask`, `syncTaskToGitHub`, `decomposeGitHubIssue`, `generateFixFromReview`, `saveReport`, `deleteReport`, `summarizeProject`, `addProjectMember`, `removeProjectMember`, `updateProjectMemberRole`, `createAutomationRule`, `updateAutomationRule`, `deleteAutomationRule`, `createWebhookEndpoint`, `updateWebhookEndpoint`, `deleteWebhookEndpoint`, `testWebhookEndpoint`, `replayWebhookDelivery`, `connectSlack`, `updateSlackIntegration`, `disconnectSlack`, `testSlackIntegration`, `mapSlackUser`, `unmapSlackUser`, `sendVerificationEmail`, `verifyEmail`, `requestPasswordReset`, `resetPassword`, `updateProfile`, `inviteOrgMember`, `acceptInvite`, `revokeInvite`

## Key File Map

| Concern | File |
|---|---|
| GraphQL schema assembly | `apps/api/src/graphql/schema.ts` |
| GraphQL typeDefs (domain-split) | `apps/api/src/graphql/typedefs/*.ts` |
| GraphQL resolvers (domain-split) | `apps/api/src/graphql/resolvers/*.ts` |
| AI subsystem | `apps/api/src/ai/` (aiService, promptBuilder, aiTypes, etc.) |
| Auth context (JWT verify) | `apps/api/src/graphql/context.ts` |
| DataLoaders (N+1 prevention) | `apps/api/src/graphql/loaders.ts` |
| AES-256-GCM encryption util | `apps/api/src/utils/encryption.ts` |
| Prometheus metrics (prom-client) | `apps/api/src/utils/metrics.ts` |
| Structured logging (pino) | `apps/api/src/utils/logger.ts` |
| SSE manager (real-time events) | `apps/api/src/utils/sseManager.ts` |
| Prisma schema (domain-split) | `apps/api/prisma/schema/*.prisma` |
| REST export routes | `apps/api/src/routes/export.ts` |
| REST API docs page | `apps/api/src/routes/docs.ts` |
| Express app setup (+ helmet/cors/rate-limit) | `apps/api/src/app.ts` |
| API entry point | `apps/api/src/index.ts` |
| API test config | `apps/api/vitest.config.ts` |
| GQL fetch helper (+ AbortController) | `apps/web/src/api/client.ts` |
| Auth React context | `apps/web/src/auth/context.tsx` |
| Vite proxy config | `apps/web/vite.config.ts` |
| App routing | `apps/web/src/App.tsx` |
| Project detail (board/backlog) | `apps/web/src/pages/ProjectDetail.tsx` |
| Project data fetching + mutations | `apps/web/src/hooks/useProjectData.ts` |
| Task search/filter logic | `apps/web/src/hooks/useTaskFiltering.ts` |
| Keyboard shortcut handling | `apps/web/src/hooks/useKeyboardShortcuts.ts` |
| Toast notification hook | `apps/web/src/hooks/useToast.ts` |
| Status ↔ column mapping, TASK_FIELDS | `apps/web/src/utils/taskHelpers.ts` |
| Shared UI (SearchInput, FilterBar, Icons, etc.) | `apps/web/src/components/shared/` |
| Kanban board (dynamic columns) | `apps/web/src/components/KanbanBoard.tsx` |
| Task detail panel (drawer) | `apps/web/src/components/TaskDetailPanel.tsx` |
| Backlog view | `apps/web/src/components/BacklogView.tsx` |
| Sprint create modal | `apps/web/src/components/SprintCreateModal.tsx` |
| Fetch-based SSE client | `apps/web/src/hooks/useEventSource.ts` |
| Loading skeletons | `apps/web/src/components/Skeleton.tsx` |
| AI task plan review dialog | `apps/web/src/components/TaskPlanApprovalDialog.tsx` |
| Web test config | `apps/web/vitest.config.ts` |

## Web Pages

- `/` — Home (unauthenticated landing or redirect)
- `/projects` — Project list for user's org
- `/projects/new` — New project form
- `/projects/:id` — Project detail with tasks
- `/orgs/new` — Create org
- `/orgs/settings` — Org settings

## Environment Variables

**API** (`apps/api/.env`):
- `DATABASE_URL` — postgres connection string
- `JWT_SECRET` — signing secret (defaults to `'dev-secret'` in dev)
- `ENCRYPTION_MASTER_KEY` — 64-char hex for AES-256-GCM API key encryption
- `CORS_ORIGINS` — comma-separated allowed origins (defaults to `http://localhost:5173`)
- `LOG_LEVEL` — pino log level (defaults to `info`)
- `SENTRY_DSN` — optional Sentry error tracking DSN

**Web** (`apps/web/.env`):
- `VITE_API_URL` — set to `/api` in dev (Vite proxy strips prefix and forwards to `:3001`)

## UX Patterns

- **Skeleton loading:** `Skeleton.tsx` provides `TaskListSkeleton`, `KanbanBoardSkeleton`, `TaskDetailSkeleton` — shown during initial data loads
- **AI generation progress:** `TaskPlanApprovalDialog` displays a step-by-step progress indicator (5 stages) during AI task plan generation
- **Input blocking during generation:** All toolbar buttons, forms, view toggles, and detail panel inputs are disabled while any AI operation is in flight (`isGenerating` flag)
- **Navigation warning:** `beforeunload` listener prevents accidental tab close during AI generation; `popstate` handler intercepts browser back/forward with a confirm dialog. If the user proceeds, the in-flight request is aborted via `AbortController`
- **Status ↔ column sync:** Changing task status in the detail panel auto-moves it to the matching kanban column; dragging a task to a new column auto-updates its status. Mapping is fuzzy (e.g. "In Progress" ↔ `in_progress`, "Done"/"Completed" ↔ `done`)
