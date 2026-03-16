# Deferred Ideas & Future Improvements

Organized into **Task Sets** optimized for parallel swarm development. Each set is self-contained — a single worker handles it start to finish without blocking or being blocked by other workers running simultaneously.

---

## Parallel Execution Model (updated 2026-03-16)

Both `schema.prisma` and `schema.ts` have been **modularized into domain files**:
- Prisma: `apps/api/prisma/schema/` — one `.prisma` file per domain (auth, org, project, task, sprint, etc.)
- GraphQL typeDefs: `apps/api/src/graphql/typedefs/` — one `.ts` file per domain
- Resolvers: `apps/api/src/graphql/resolvers/` — already split by domain

**This means the old "only 1 schema set per wave" constraint is relaxed.** Sets that touch *different* domain files can now run in parallel. The constraint only applies when two sets modify the *same* domain file (e.g., both touching `typedefs/task.ts`).

### Swarm Assignment Rules

1. **Check file overlap.** Two sets can run in parallel if their `files` arrays don't overlap.
2. **Independent sets run freely.** Assign to any available worker in any wave.
3. **Workers work uninterrupted.** Each set is fully self-contained — no cross-set dependencies within a wave.

---

## Remaining Feature Sets

### S6: User & Profile
**Touches:** `prisma/schema/auth.prisma`, `typedefs/auth.ts`, `resolvers/auth.ts`, new frontend components

- [ ] User avatars — upload/set profile avatar, display on task cards, board, comments, and assignee dropdowns
- [ ] Profile management — edit display name, timezone, notification prefs from user settings page

### S7: External Integrations
**Touches:** `prisma/schema/org.prisma`, `typedefs/org.ts`, new backend services, `OrgSettings.tsx`

- [ ] Slack integration — channel notifications, create tasks from Slack
- [ ] Webhook support — outgoing webhooks on task events

### S8: Advanced Task Features
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/task.ts`, `TaskDetailPanel.tsx`, `useProjectData.ts`

- [ ] Custom fields on tasks — user-defined fields per project (dropdown, number, text, date) with filtering support
- [ ] Multiple assignees — support multiple `assigneeId`s per task for collaborative work
- [ ] Recurring tasks — auto-recreate on schedule (also needs cron/scheduler)
- [ ] File attachments on tasks — upload images/docs/screenshots (also needs storage service)
- [ ] Task templates — reusable task structures for repeated workflows

### S9: Permissions & Automation
**Touches:** `prisma/schema/` (new models), `typedefs/` (new files), `context.ts`, `resolvers/*`, new automation engine

- [ ] Project-level roles — per-project access control (viewer, editor, admin)
- [ ] Automation rules — configurable triggers (e.g. "when Done → notify assignee")

### S10: Filters & Tech Debt
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/*`, `useTaskFiltering.ts`, `FilterBar.tsx`

- [ ] Saved filters / views — save and name filter configurations for quick access
- [ ] JSON string columns → Prisma Json type — Sprint.columns, Task.suggestedTools
- [ ] Shared types between API and web — consider graphql-codegen or shared package

---

## Independent Feature Sets (run alongside any other set)

### I5: New AI Features
**Touches:** `ai/*`, `resolvers/ai.ts`, `promptBuilder.ts` — reuse existing mutations/types

- [ ] Deduplicate "add more tasks" — prevent AI task generation from creating tasks that duplicate existing task titles in the project
- [ ] Bug report → Task — AI parses bug report into structured task _(reuse existing `extractTasksFromNotes` mutation)_
- [ ] Sprint transition analyzer — AI analyzes backlog on sprint close
- [ ] PRD → Task breakdown — AI breaks PRD into epics/tasks
- [ ] GitHub repo → Project bootstrap — import existing repo, AI analyzes codebase structure (files, languages, README, package.json) to auto-generate project with initial task breakdown
- [ ] Repo ↔ Task drift analysis — for projects with a linked repo, AI compares current repo state (recent commits, open PRs, file changes) against the task set to flag outdated tasks, suggest new tasks for untracked work, and identify completed tasks that haven't been marked done
- [ ] Contextual project chat — NL Q&A grounded in live project data
- [ ] Historical summary analysis — trend analysis over persisted reports
- [ ] Batch code generation — generate code for multiple related tasks in one PR _(depends on: Epics — completed)_
- [ ] Prompt replay / history — save AI prompts + responses per task for debugging and cost tracking

> **Note:** Some items above (sprint transition, contextual chat, prompt history) may need new typeDef/resolver files when planned in detail. If so, the planner should note the specific domain files touched.

### I7: Real-time
**Touches:** `app.ts` (websocket/SSE setup), new client-side hooks — independent transport layer

- [ ] Real-time updates (websockets or SSE) — push task/sprint/comment changes to all connected clients

### I8: Advanced Views
**Touches:** new `apps/web/src/components/` files, `ProjectDetail.tsx`, `useProjectData.ts`

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts
- [ ] Public REST/GraphQL API docs — documented API for third-party use

---

## Audit & Improvement Sets (added 2026-03-16)

### A1: DataLoader Integration & Database Query Optimization
**Touches:** `context.ts`, `resolvers/*`, `prisma/schema/*.prisma`, new `graphql/dataloaders.ts` or `graphql/loaders/`

**DataLoader setup (solves all N+1 field resolver problems):**
- [ ] Install `dataloader` package (`pnpm --filter api add dataloader`) and add `@types/dataloader` if needed
- [ ] Create `apps/api/src/graphql/loaders.ts` — factory function `createLoaders(prisma)` that returns per-request DataLoader instances for each batched relation:
  - `taskLabelsLoader` — batch load labels for multiple taskIds via `TaskLabel` join table
  - `taskPullRequestsLoader` — batch load `GitHubPullRequestLink` by taskIds
  - `taskCommitsLoader` — batch load `GitHubCommitLink` by taskIds
  - `taskChildrenLoader` — batch load child tasks by parentTaskIds
  - `taskProgressLoader` — batch load subtask counts/completion for epic/story tasks
  - `taskByIdLoader` — batch load tasks by taskId (replaces repeated `findUnique` in resolvers)
  - `projectByIdLoader` — batch load projects by projectId (replaces 15+ repeated fetch patterns in ai.ts, github.ts, etc.)
  - `sprintByIdLoader` — batch load sprints by sprintId
  - `userByIdLoader` — batch load users by userId (for assignee resolution, comment authors)
  - `sprintTasksLoader` — batch load tasks grouped by sprintId (fixes sprintVelocity N+1)
- [ ] Attach loaders to GraphQL context — update `context.ts` to call `createLoaders(prisma)` per request and add `loaders` to the `Context` type; DataLoaders are per-request (short-lived cache, automatic batching)
- [ ] Refactor Task field resolvers to use DataLoaders — replace `Task.labels`, `Task.pullRequests`, `Task.commits`, `Task.children`, `Task.progress` field resolvers in `resolvers/task.ts` to call `context.loaders.taskLabelsLoader.load(task.taskId)` etc. instead of individual Prisma queries
- [ ] Refactor entity lookups to use DataLoaders — replace `prisma.task.findUnique({ where: { taskId } })` calls in `resolvers/ai.ts`, `resolvers/github.ts`, `resolvers/sprint.ts` with `context.loaders.taskByIdLoader.load(taskId)` for automatic batching and per-request caching
- [ ] Refactor `sprintVelocity` to use `sprintTasksLoader` — eliminate loop-query pattern (`resolvers/sprint.ts:20-44`); batch load all tasks for closed sprints in one query

**Other database optimizations:**
- [ ] Fix N+1 in `closeSprint` — batch fetch tasks and target sprints with `findMany` + Map lookups instead of per-item queries (`resolvers/sprint.ts:186-224`)
- [ ] Optimize burndown chart query — push date filtering to database instead of fetching all activities and filtering in-memory O(days × activities) (`resolvers/sprint.ts:46-107`)
- [ ] Add PostgreSQL full-text search — replace `LIKE` queries in `globalSearch` with `to_tsvector/plainto_tsquery` for efficient search on large datasets (`resolvers/search.ts:12-27`)
- [ ] Add missing indexes — `Task(orgId, archived)` for projectStats, `Activity(action, field, createdAt)` for burndown, `Activity(taskId, createdAt)` for activity queries
- [ ] Validate JSON.parse calls — add try/catch + Zod validation for `project.statuses`, `sprint.columns`, `task.dependsOn`, `task.suggestedTools` parsing across resolvers

### A2: Frontend Performance & Architecture
**Touches:** `useProjectData.ts`, `TaskDetailPanel.tsx`, `BacklogView.tsx`, `KanbanBoard.tsx`, `ProjectDetail.tsx`, new extracted components

- [ ] Split `useProjectData.ts` (~1150 lines, 37 useState, 40+ functions) into focused hooks: `useTasks()`, `useSprintManagement()`, `useAIGeneration()`, `useProjectUI()` — current god-object causes excessive re-renders and prop drilling
- [ ] Decompose `TaskDetailPanel.tsx` (~780 lines, 73+ props) — extract `TaskTitleEditor`, `TaskFieldsPanel`, `GitHubTaskSection`, `TaskPRSection`, `TaskCommitsSection` sub-components
- [ ] Decompose `BacklogView.tsx` (~533 lines) — extract `SprintSection` component with its own DnD logic
- [ ] Add `useMemo`/`useCallback` coverage — `useProjectData` has only 1 useCallback; all mutation handlers recreated every render, causing unnecessary child re-renders
- [ ] Memoize KanbanBoard column grouping — `tasks.filter()` per column in render is O(tasks × columns); pre-compute with `useMemo` into a Map
- [ ] Memoize blocked-task status — `KanbanBoard` computes blocked status per task per render with O(n²) `tasks.find()` lookups; precompute blocked Map
- [ ] Extract GraphQL query strings — inline queries in `useProjectData` are fragile; move to `queries.ts` with typed constants
- [ ] Replace direct `setState` exports — `useProjectData` exposes raw `setSelectedTask`, `setErr` dispatchers; wrap in action functions that enforce invariants
- [ ] Lazy-load `react-markdown` + `remark-gfm` (~60KB gzipped) — only import on pages that render markdown

### A3: API Design & Error Handling
**Touches:** `resolvers/*`, `typedefs/*`, `context.ts`, `utils/`

- [ ] Extract `requireTask(context, taskId)` utility — same task fetch + org validation pattern repeated 15+ times across `ai.ts`, `task.ts`, `sprint.ts`, `github.ts` resolvers
- [ ] Extract `requireProject(context, projectId)` utility — same pattern for project validation
- [ ] Extract `validateStatus(statuses, proposed)` utility — status validation logic duplicated in `task.ts` and `project.ts`
- [ ] Add GraphQL error codes — custom errors (NotFoundError, ValidationError) lack standardized codes for client-side handling; add `ERR_NOT_FOUND`, `ERR_VALIDATION`, `ERR_UNAUTHORIZED`, etc.
- [ ] Fix inconsistent mutation return types — `deleteComment` returns `Boolean` (prevents client refresh); `markAllNotificationsRead` returns `Boolean`; all mutations should return affected objects
- [ ] Add cursor-based pagination — `reports` query and `activities` query use `take` without offset/cursor for continuation
- [ ] Add input validation with Zod at resolver boundaries — task titles (no length limit), URLs (no format check), JSON fields (parsed without schema)
- [ ] Wrap `Promise.all` task creation with error handling — `commitTaskPlan` and similar resolvers silently fail if one create errors, leaving inconsistent state

### A4: AI Token & Cost Optimization
**Touches:** `ai/promptBuilder.ts`, `ai/aiConfig.ts`, `ai/aiCache.ts`, `ai/aiService.ts`

- [ ] Move response schema definition to system prompt — task plan prompt includes ~100-token JSON schema instructions per call; put in system prompt (reused, not per-call)
- [ ] Reduce code gen file list from 30 to 15 — `buildGenerateCodePrompt` includes up to 30 project files; cap at 15 most relevant, saving 500+ tokens per call
- [ ] Enable caching for `generateTaskPlan` and `expandTask` — most common AI ops have `cacheTTLMs: 0`; same prompt + project = same result; add 24hr/12hr TTL
- [ ] Increase LRU cache size from 50 to 500 entries — current 50-entry limit evicts useful results quickly; 500 entries = ~2MB memory (negligible)
- [ ] Add GitHub API response caching — `listInstallationRepos` and `fetchProjectFileTree` hit GitHub every call; add 1-hour in-memory cache with webhook invalidation
- [ ] Make `suggestedTools` and `subtasks` optional in task plan response — currently required in every AI task plan response, adding ~300 tokens; make opt-in

### A5: Build, Deps & DevEx
**Touches:** root `package.json`, `apps/api/package.json`, `apps/web/package.json`, `.eslintrc.cjs`, `vite.config.ts`, `pnpm-workspace.yaml`

- [ ] Declare ESLint dependencies — `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-prettier` referenced in `.eslintrc.cjs` but not declared in any `package.json`; CI/CD may fail
- [ ] Add React ESLint rules — `eslint-plugin-react` and `eslint-plugin-react-hooks` not installed; missing hooks-rules-of-hooks and exhaustive-deps enforcement
- [ ] Add compression middleware — `compression` package for gzip responses in production; missing from Express stack (`app.ts`)
- [ ] Add HTTP request logging — no request-level logging middleware; add `pino-http` to Express stack for request/response logging
- [ ] Configure Vite chunk splitting — no `rollupOptions.manualChunks` config; split `react`, `react-router-dom`, `react-markdown` into separate chunks for better caching
- [ ] Fix `pnpm-workspace.yaml` — references `packages/*` directory that doesn't exist; remove to prevent warnings
- [ ] Audit pino logger production transport — dev mode uses `pino/file` transport but production path may result in silent logging

### A6: Security Hardening
**Touches:** `resolvers/*`, `promptBuilder.ts`, `context.ts`, `app.ts`

- [ ] Sanitize user input in AI prompts — `appendToTitles` in `previewTaskPlan` is injected directly into prompt string without escaping; use proper `<user_input>` tag wrapping (`resolvers/ai.ts:158-159`)
- [ ] Add string length limits at resolver boundaries — task titles, descriptions, knowledge base, comments have no max length enforced; add validation (title: 500, description: 10000, knowledge base: 5000)
- [ ] Rate-limit password reset and email verification endpoints — currently only signup/login have auth-specific rate limits; add to `requestPasswordReset` and `sendVerificationEmail`
- [ ] Add Content-Security-Policy headers — helmet defaults may not include strict CSP; configure for production

---

## Completed

### S3: Project Intelligence (Wave 4, 2026-03-16) — in progress
- [ ] Project knowledge base — per-project context injected into AI prompts
- [ ] Acceptance criteria in task generation — add acceptance criteria field to Task model

### S4: GitHub Automation (Wave 4, 2026-03-16) — in progress
- [ ] Code review feedback loop — AI reads PR review comments and generates fix commits
- [ ] AI code review — AI reviews PRs linked to tasks, checks against requirements, suggests improvements
- [ ] AI task decomposition from GitHub issues — import GitHub issue → AI breaks into TaskToad tasks with instructions
- [ ] Generated code diff view — show diff against existing repo files in code preview modal

### S5: Notifications & Email (Wave 4, 2026-03-16) — in progress
- [ ] Email notifications — configurable email alerts (assigned, due date, mentioned, sprint events)
- [ ] Notification preferences — per-user settings for notification channels (in-app, email, both)
- [ ] Due date reminders — scheduled alerts before task due dates (1 day, 1 hour)

### I6: Data Export (Wave 3, 2026-03-16)
- [x] Activity / audit log export — REST endpoints for CSV/JSON
- [x] Project export — REST endpoints for CSV/JSON
- [x] CSV import — column mapping UI with client-side parsing

### Schema Modularization (Wave 3, 2026-03-16)
- [x] Split `schema.prisma` into domain-based files in `prisma/schema/`
- [x] Split `schema.ts` typeDefs into domain-based modules in `graphql/typedefs/`

---

## Parallelism Matrix (which sets can run together)

Sets that **conflict** (share domain files):
- S8 + S10 (both touch `task.prisma`, `typedefs/task.ts`)
- A1 + A3 (both touch `resolvers/*`)
- A2 + I8 (both touch `useProjectData.ts`, `ProjectDetail.tsx`)

Sets that **can run in parallel** (no file overlap):
- S6 + S7 + A4 (auth vs org vs ai-only)
- S8 + S9 + A5 (task vs permissions vs build config)
- A1 + A2 + A5 (db queries vs frontend vs build)
- A4 + A6 + I5 (ai optimization vs security vs ai features)
- Any A-set with most S-sets and I-sets (check specific file lists)
