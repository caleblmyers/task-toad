# TaskToad App Overview

## What It Is

Multi-tenant SaaS project management MVP. Users belong to orgs; orgs own projects; projects contain tasks.

## Auth Flow

1. User calls `signup(email, password)` or `login(email, password)` mutation
2. API sets two HttpOnly cookies: `access_token` (15-min JWT, HS256 via `jose`, payload: `sub`, `email`, `tv`) and `refresh_token` (7-day opaque token stored hashed in DB)
3. Cookies are `HttpOnly`, `Secure` (in production), `SameSite=Strict`, `Path=/api`
4. Subsequent requests send cookies automatically; `context.ts` reads `access_token` from cookie (falls back to `Authorization: Bearer` header for API clients)
5. `context.ts` verifies token, loads user, checks `tokenVersion` matches JWT `tv` claim
6. CSRF protection: `POST /graphql` requires `X-Requested-With` header (any value); requests without it get 403
7. Token refresh: `POST /api/auth/refresh` validates refresh token cookie, issues new access + refresh tokens, rotates refresh token in DB
8. `verifyEmail` mutation sets cookies on success — auto-login after email verification
9. `logout` mutation increments `tokenVersion`, clears cookies, invalidates refresh token
10. Sensitive operations (e.g., `setOrgApiKey`) require `confirmPassword` argument for re-authentication
11. Session expiry: frontend shows `SessionExpiredModal` instead of hard-redirecting to /login (preserves unsaved work)

## Data Model (Prisma)

Domain-split schema files in `apps/api/prisma/schema/`. Key models:

```
User              — id, email, passwordHash, orgId, role, tokenVersion, emailVerifiedAt
Org               — id, name, anthropicApiKeyEncrypted, monthlyBudgetCentsUSD
Project           — id, name, description, orgId, statuses? (JSON)
Sprint            — id, name, orgId, projectId, isActive, columns (JSON), wipLimits (JSON), startDate?, endDate?
Task              — id, title, status, projectId, orgId, parentTaskId?, sprintId?, sprintColumn?, taskType
                    priority, estimatedHours, storyPoints, description, instructions, autoComplete
TaskAssignee      — taskId, userId (join table, multiple assignees)
TaskWatcher       — taskId, userId (join table, auto-added on create/assign/mention)
TaskDependency    — sourceTaskId, targetTaskId, linkType (blocks/relates_to/duplicates/informs)
Label             — id, name, color, projectId
Comment           — id, taskId, userId, content, parentCommentId? (threaded)
Activity          — id, taskId?, projectId?, userId, action, field?, oldValue?, newValue?
Notification      — id, userId, type, title, body?, linkUrl?, read
Report            — id, type, projectId, data (JSON)
Release           — id, name, version, status, projectId, releaseDate?, releaseNotes?
ReleaseTask       — releaseId, taskId (join table)
TimeEntry         — id, taskId, userId, durationMinutes, loggedDate, billable, description?
UserCapacity      — id, orgId, userId, hoursPerWeek
UserTimeOff       — id, orgId, userId, startDate, endDate, description?
KnowledgeEntry    — id, projectId, orgId, title, content, source, category
SavedFilter       — id, projectId, userId, name, filters (JSON), viewType?, sortBy?, groupBy?, isShared
WorkflowTransition — id, projectId, fromStatus, toStatus
AutomationRule    — id, projectId, orgId, name, trigger (JSON), action (JSON), enabled
ProjectMember     — projectId, userId, role (viewer/editor/admin)
CustomField       — id, projectId, name, fieldType, options?
ActionPlan        — id, taskId, status, actions (ordered)
GitHubInstallation, GitHubCommitLink, GitHubPullRequestLink
WebhookEndpoint   — id, orgId, url, secret (encrypted), events, isActive
WebhookDelivery   — id, endpointId, event, payload, status, attemptCount
SlackIntegration, SlackUserMapping
TaskInsight       — id, sourceTaskId, targetTaskId?, projectId, orgId, type (discovery/warning/pattern), content, autoApplied
AIPromptLog       — id, orgId, feature, model, tokenCount, cost, prompt (redacted)
```

**Roles:** User has `role` (org:admin/org:member). ProjectMember has `role` (viewer/editor/admin). Permission scheme maps roles → 22 granular permissions via `requirePermission()`.

**Sprints:** Multiple per project, at most one `isActive`. Dynamic columns as JSON array. WIP limits as JSON object. Tasks assigned via `sprintId` (null = backlog).

## Request Path (dev)

```
Browser → Vite dev server (localhost:5173)
       → proxy /api/* → Express (localhost:3001)
       → graphql-yoga at POST /graphql
       → resolver → Prisma → PostgreSQL (Docker, port 5432)
```

## GraphQL Operations

**Public (no auth):** `signup`, `login`

**Authed queries:** `me`, `orgInvites`, `org`, `orgUsers`, `projects`, `project(projectId)`, `projectStats`, `portfolioOverview`, `savedFilters`, `tasks(projectId)`, `epics`, `labels`, `customFields`, `sprints(projectId)`, `sprintVelocity`, `sprintBurndown`, `comments`, `activities`, `aiUsage`, `aiPromptHistory`, `analyzeTrends`, `analyzeSprintTransition`, `projectChat`, `analyzeRepoDrift`, `notifications`, `unreadNotificationCount`, `notificationPreferences`, `githubInstallations`, `githubInstallationRepos`, `githubProjectRepo`, `fetchRepoFileContent`, `knowledgeEntries(projectId)`, `previewHierarchicalPlan(projectId, prompt)`, `taskInsights(projectId, taskId?)`, `projectActionPlans(projectId, status?)`, `reports`, `generateStandupReport`, `generateSprintReport`, `analyzeProjectHealth`, `extractTasksFromNotes`, `globalSearch`, `projectMembers`, `automationRules`, `webhookEndpoints`, `webhookDeliveries`, `slackIntegrations`, `slackUserMappings`

**Authed mutations:** `createOrg`, `setOrgApiKey`, `setAIBudget`, `createProject`, `updateProject`, `archiveProject`, `generateProjectOptions`, `createProjectFromOption`, `saveFilter`, `updateFilter`, `deleteFilter`, `createTask`, `updateTask`, `createSubtask`, `bulkUpdateTasks`, `createLabel`, `deleteLabel`, `addTaskLabel`, `removeTaskLabel`, `generateTaskPlan`, `previewTaskPlan`, `commitTaskPlan`, `expandTask`, `generateTaskInstructions`, `createCustomField`, `updateCustomField`, `deleteCustomField`, `setCustomFieldValue`, `addTaskAssignee`, `removeTaskAssignee`, `createSprint`, `updateSprint`, `deleteSprint`, `closeSprint`, `previewSprintPlan`, `commitSprintPlan`, `createComment`, `updateComment`, `deleteComment`, `generateCodeFromTask`, `regenerateCodeFile`, `reviewPullRequest`, `parseBugReport`, `previewPRDBreakdown`, `commitPRDBreakdown`, `bootstrapProjectFromRepo`, `batchGenerateCode`, `markNotificationRead`, `markAllNotificationsRead`, `updateNotificationPreference`, `linkGitHubInstallation`, `connectGitHubRepo`, `disconnectGitHubRepo`, `createGitHubRepo`, `createPullRequestFromTask`, `syncTaskToGitHub`, `decomposeGitHubIssue`, `generateFixFromReview`, `saveReport`, `deleteReport`, `summarizeProject`, `addProjectMember`, `removeProjectMember`, `updateProjectMemberRole`, `createAutomationRule`, `updateAutomationRule`, `deleteAutomationRule`, `createWebhookEndpoint`, `updateWebhookEndpoint`, `deleteWebhookEndpoint`, `testWebhookEndpoint`, `replayWebhookDelivery`, `connectSlack`, `updateSlackIntegration`, `disconnectSlack`, `testSlackIntegration`, `mapSlackUser`, `unmapSlackUser`, `sendVerificationEmail`, `verifyEmail`, `requestPasswordReset`, `resetPassword`, `updateProfile`, `inviteOrgMember`, `acceptInvite`, `revokeInvite`, `createKnowledgeEntry`, `updateKnowledgeEntry`, `deleteKnowledgeEntry`, `generateOnboardingQuestions`, `saveOnboardingAnswers`, `commitHierarchicalPlan`, `dismissInsight`, `cancelActionPlan`, `generateManualTaskSpec`, `autoStartProject`

## Key File Map

| Concern | File |
|---|---|
| GraphQL schema assembly | `apps/api/src/graphql/schema.ts` |
| GraphQL typeDefs (domain-split) | `apps/api/src/graphql/typedefs/*.ts` |
| GraphQL resolvers (domain-split) | `apps/api/src/graphql/resolvers/*.ts` |
| AI subsystem | `apps/api/src/ai/` (aiService, promptBuilder, aiTypes, etc.) |
| KB retrieval (AI-based entry selection) | `apps/api/src/ai/knowledgeRetrieval.ts` |
| Action plan executors | `apps/api/src/actions/executors/` (generateCode, createPR, reviewPR, writeDocs, manualStep) |
| Action plan registry | `apps/api/src/actions/registry.ts` + `index.ts` |
| Job executor (action pipeline) | `apps/api/src/infrastructure/jobs/actionExecutor.ts` |
| Event bus (typed domain events) | `apps/api/src/infrastructure/eventbus/` |
| Auto-complete orchestrator listener | `apps/api/src/infrastructure/listeners/orchestratorListener.ts` |
| Auth context (JWT verify) | `apps/api/src/graphql/context.ts` |
| DataLoaders (N+1, orgId-scoped) | `apps/api/src/graphql/loaders.ts` |
| AES-256-GCM encryption util | `apps/api/src/utils/encryption.ts` |
| Per-org AI rate limiter | `apps/api/src/utils/aiRateLimiter.ts` |
| Audit logging (fire-and-forget) | `apps/api/src/utils/auditLog.ts` |
| Data migration scripts | `apps/api/scripts/migrate-encrypt-secrets.ts`, `migrate-hash-invite-tokens.ts` |
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
| Action plan progress panel | `apps/web/src/components/ActionProgressPanel.tsx` |
| Action plan preview/approval | `apps/web/src/components/ActionPlanDialog.tsx` |
| Knowledge base panel (CRUD + file upload) | `apps/web/src/components/KnowledgeBasePanel.tsx` |
| Onboarding interview wizard | `apps/web/src/components/OnboardingWizard.tsx` |
| Execution dashboard (auto-complete status) | `apps/web/src/components/ExecutionDashboard.tsx` |
| Insight review panel | `apps/web/src/components/taskdetail/InsightPanel.tsx` |
| Manual task spec view | `apps/web/src/components/taskdetail/ManualTaskSpecView.tsx` |
| Hierarchical plan editor (tree view) | `apps/web/src/components/HierarchicalPlanEditor.tsx` |
| Hierarchical plan dialog (generate/edit/commit) | `apps/web/src/components/HierarchicalPlanDialog.tsx` |
| Batch cycle detection utility | `apps/api/src/utils/cyclicDependencyCheck.ts` |
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
- `AI_RATE_LIMIT_PER_HOUR` — per-org AI request limit (defaults to `60`)

**Web** (`apps/web/.env`):
- `VITE_API_URL` — set to `/api` in dev (Vite proxy strips prefix and forwards to `:3001`)

## UX Patterns

- **Skeleton loading:** `Skeleton.tsx` provides `TaskListSkeleton`, `KanbanBoardSkeleton`, `TaskDetailSkeleton` — shown during initial data loads
- **AI generation progress:** `TaskPlanApprovalDialog` displays a step-by-step progress indicator (5 stages) during AI task plan generation
- **Input blocking during generation:** All toolbar buttons, forms, view toggles, and detail panel inputs are disabled while any AI operation is in flight (`isGenerating` flag)
- **Navigation warning:** `beforeunload` listener prevents accidental tab close during AI generation; `popstate` handler intercepts browser back/forward with a confirm dialog. If the user proceeds, the in-flight request is aborted via `AbortController`
- **Status ↔ column sync:** Changing task status in the detail panel auto-moves it to the matching kanban column; dragging a task to a new column auto-updates its status. Mapping is fuzzy (e.g. "In Progress" ↔ `in_progress`, "Done"/"Completed" ↔ `done`)
- **Auto-Complete pipeline:** Tasks with instructions show an "Auto-Complete" button that generates an action plan (via AI), then executes it step-by-step: `generate_code` → `create_pr` → `review_pr`. Progress updates in real-time via SSE. On completion, task status transitions to `in_review`. The standalone "Generate code" button has been removed — Auto-Complete is the sole code gen entry point.
- **Action plan progress:** `ActionProgressPanel` renders live step-by-step progress with status icons, inline review results (approval badge, severity-colored comments, suggestions), and controls for manual steps/retry/skip/cancel.
