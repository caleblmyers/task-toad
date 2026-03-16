# Deferred Ideas & Future Improvements

Organized into **Task Sets** optimized for parallel swarm development. Each set is self-contained — a single worker handles it start to finish without blocking or being blocked by other workers running simultaneously.

---

## Parallel Execution Model (updated 2026-03-16)

Both `schema.prisma` and `schema.ts` have been **modularized into domain files**:
- Prisma: `apps/api/prisma/schema/` — one `.prisma` file per domain (auth, org, project, task, sprint, etc.)
- GraphQL typeDefs: `apps/api/src/graphql/typedefs/` — one `.ts` file per domain
- Resolvers: `apps/api/src/graphql/resolvers/` — already split by domain

### Swarm Assignment Rules

1. **Check file overlap.** Two sets can run in parallel if their `files` arrays don't overlap.
2. **Independent sets run freely.** Assign to any available worker in any wave.
3. **Workers work uninterrupted.** Each set is fully self-contained — no cross-set dependencies within a wave.

### Task Sizing (CRITICAL)

Each swarm task MUST represent **30-60 minutes** of focused agentic work. Never create tasks that are just config changes or single-file edits.

- **Combine into full vertical slices:** schema + resolver + typeDefs + frontend in ONE task, not separate tasks per layer.
- **Bundle config into features:** A caching config change is part of the feature it supports, not its own task.
- **Target:** Each worker should have 2-4 tasks totaling 30-60 min, not 6 tasks totaling 5 min.
- **Bad example:** "Add customField to Prisma schema" (2 min) → "Add resolver for customField" (3 min) → "Add UI for customField" (5 min)
- **Good example:** "Add custom fields on tasks — Prisma model, GraphQL types/resolver CRUD, TaskDetailPanel UI, filtering support" (45 min)

---

## Work Sets

### W1: Full-Stack Quality Refactor (partially completed)
**Touches:** `useProjectData.ts`, `TaskDetailPanel.tsx`, `BacklogView.tsx`, `KanbanBoard.tsx`, `ProjectDetail.tsx`, `resolvers/*`, `typedefs/*`, `context.ts`, `utils/`, `promptBuilder.ts`, `app.ts`

**Frontend architecture (remaining):**
- [ ] Decompose `BacklogView.tsx` (~533 lines) — extract `SprintSection` component with its own DnD logic
- [ ] Replace direct `setState` exports with action functions that enforce invariants
- [ ] Lazy-load `react-markdown` + `remark-gfm` (~60KB gzipped) — only import on pages that render markdown

**API design & error handling:**
- [ ] Extract `requireTask(context, taskId)` and `requireProject(context, projectId)` utilities — same fetch + org validation pattern repeated 15+ times across resolvers
- [ ] Extract `validateStatus(statuses, proposed)` utility — duplicated in `task.ts` and `project.ts`
- [ ] Add GraphQL error codes — `ERR_NOT_FOUND`, `ERR_VALIDATION`, `ERR_UNAUTHORIZED` etc. for client-side handling
- [ ] Fix inconsistent mutation return types — `deleteComment` and `markAllNotificationsRead` return `Boolean`; all mutations should return affected objects
- [ ] Add cursor-based pagination — `reports` and `activities` queries use `take` without offset/cursor
- [ ] Add input validation with Zod at resolver boundaries — string length limits (title: 500, description: 10000), URL format, JSON schema validation
- [ ] Wrap `Promise.all` task creation with error handling — `commitTaskPlan` silently fails if one create errors

**Security:**
- [ ] Sanitize `appendToTitles` in `previewTaskPlan` — currently injected directly into prompt without escaping (`resolvers/ai.ts`)
- [ ] Add string length limits at resolver boundaries — task titles, descriptions, knowledge base, comments
- [ ] Rate-limit password reset and email verification endpoints
- [ ] Add Content-Security-Policy headers via helmet config

### W2: Advanced Tasks & Filters
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/task.ts`, `TaskDetailPanel.tsx`, `useProjectData.ts`, `useTaskFiltering.ts`, `FilterBar.tsx`
**Est. time:** 45-60 min

- [ ] Custom fields on tasks — user-defined fields per project (dropdown, number, text, date) with filtering support. Full slice: Prisma model (CustomField + CustomFieldValue), GraphQL types + CRUD mutations, TaskDetailPanel rendering of custom fields, FilterBar integration
- [ ] Multiple assignees — support multiple `assigneeId`s per task. Full slice: join table in Prisma, GraphQL type update, resolver update, assignee picker UI supporting multi-select
- [ ] Recurring tasks — auto-recreate on schedule. Full slice: Prisma fields (recurrenceRule, recurrenceParentId), cron/scheduler utility, creation logic, UI toggle in TaskDetailPanel
- [ ] File attachments on tasks — upload images/docs/screenshots. Full slice: storage service abstraction (local + S3), Prisma model (Attachment), upload endpoint, TaskDetailPanel attachment section
- [ ] Task templates — reusable task structures for repeated workflows. Full slice: Prisma model (TaskTemplate), CRUD mutations, "Create from template" UI in project toolbar
- [ ] Saved filters / views — save and name filter configurations for quick access. Full slice: Prisma model (SavedFilter), CRUD mutations, filter dropdown in FilterBar with save/load
- [ ] JSON string columns → Prisma Json type — Sprint.columns, Task.suggestedTools (migration + resolver updates)
- [ ] Shared types between API and web — evaluate graphql-codegen or shared package for type safety

### W3: Users, Roles & Automation — COMPLETED (Wave 6, 2026-03-16)
_Moved to Completed section_

### W4: AI Power Features — COMPLETED (Wave 6, 2026-03-16)
_Moved to Completed section_

### W5: External Integrations & Real-time (partially completed)
**Touches:** `prisma/schema/org.prisma`, `typedefs/org.ts`, new backend services, `OrgSettings.tsx`, `app.ts`, new client-side hooks

- [ ] Slack integration — channel notifications for task events, create tasks from Slack. Full slice: Prisma model (SlackIntegration with webhookUrl, channelId), Slack webhook client service, notification utility integration (send to Slack when creating notifications), slash command endpoint for task creation, OrgSettings UI for connecting Slack workspace

### W6: Advanced Views & AI Extras (partially completed)
**Touches:** new `apps/web/src/components/` files, `ProjectDetail.tsx`, `useProjectData.ts`, `ai/*`, `resolvers/ai.ts`

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies. Full slice: GanttChart component with SVG rendering, task bars positioned by start/due date, dependency arrows, zoom/scroll, integrated as new view tab in ProjectDetail
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts. Full slice: `portfolioOverview` query aggregating stats across projects, Portfolio page component with project cards showing health scores and progress bars, route in App.tsx
- [ ] Public REST/GraphQL API docs — documented API for third-party use. Full slice: auto-generate from GraphQL schema using graphql-markdown or similar, serve at `/api/docs`, add auth token instructions
- [ ] Historical summary analysis — trend analysis over persisted reports. Full slice: query past reports, prompt builder for trend analysis, `analyzeTrends` query, trend chart component
- [ ] Prompt replay / history — save AI prompts + responses per task for debugging and cost tracking. Full slice: Prisma model (AIPromptLog with input/output/tokens/cost), persist in AI service layer, UI panel in task detail showing prompt history

---

## Completed

### W1 (partial): Frontend Architecture Refactor (Wave 6, 2026-03-16)
- [x] Split `useProjectData.ts` into focused hooks: `useTasks()`, `useSprintManagement()`, `useAIGeneration()`, `useProjectUI()`
- [x] Decompose `TaskDetailPanel.tsx` — extracted sub-components
- [x] Add `useMemo`/`useCallback` coverage — memoized KanbanBoard and BacklogView
- [x] Extract GraphQL query strings from `useProjectData` into `queries.ts` with typed constants

### W3: Users, Roles & Automation (Wave 6, 2026-03-16)
- [x] User avatars — profile avatar with display on task cards, board, comments, assignee dropdowns
- [x] Profile management — display name, timezone, notification prefs, user settings page
- [x] Project-level roles — per-project access control (viewer, editor, admin) with permission checks
- [x] Automation rules — configurable triggers with rule evaluation engine and builder UI

### W4: AI Power Features (Wave 6, 2026-03-16)
- [x] Deduplicate "add more tasks" — prevent AI from generating duplicate tasks
- [x] Bug report → Task — AI parses bug report into structured task with UI
- [x] PRD → Task breakdown — AI breaks PRD into epics/tasks with preview/commit flow
- [x] Sprint transition analyzer — AI analyzes backlog on sprint close
- [x] GitHub repo → Project bootstrap — import repo, AI generates initial tasks

### W5 (partial): External Integrations (Wave 6, 2026-03-16)
- [x] Outgoing webhooks — HMAC-signed webhooks on task/sprint/comment events with management UI
- [x] Real-time updates via SSE — server-sent events with auth, client hook, live UI updates

### W6 (partial): AI Extras (Wave 6, 2026-03-16)
- [x] Contextual project chat — NL Q&A grounded in live project data
- [x] Repo ↔ Task drift analysis — AI compares repo state against tasks to flag outdated work
- [x] Batch code generation — generate code for multiple related tasks in one PR

### A1: DataLoader & DB Optimization (Wave 5, 2026-03-16)
- [x] DataLoader infrastructure — 10 loaders, per-request instances, context integration
- [x] Task field resolvers refactored to use DataLoaders (labels, PRs, commits, children, progress)
- [x] Entity lookups refactored (taskById, projectById loaders in ai/sprint/github resolvers)
- [x] Missing database indexes added, burndown/search queries optimized

### A4: AI Token & Cost Optimization (Wave 5, 2026-03-16)
- [x] LRU cache increased to 500, task plan/expand caching enabled
- [x] Response schema moved to system prompt, file list capped at 15
- [x] GitHub API response caching with webhook invalidation

### A5: Build, Deps & DevEx (Wave 5, 2026-03-16)
- [x] ESLint + React lint rules installed and configured
- [x] Compression middleware, Vite chunk splitting, workspace config fixed

### S3: Project Intelligence (Wave 4, 2026-03-16)
- [x] Project knowledge base — per-project context injected into AI prompts
- [x] Acceptance criteria in task generation — add acceptance criteria field to Task model

### S4: GitHub Automation (Wave 4, 2026-03-16)
- [x] Code review feedback loop, AI code review, GitHub issue decomposition, code diff view

### S5: Notifications & Email (Wave 4, 2026-03-16)
- [x] Email notifications, notification preferences, due date reminders

### I6: Data Export (Wave 3, 2026-03-16)
- [x] Activity/project export (CSV/JSON), CSV import with column mapping

### Schema Modularization (Wave 3, 2026-03-16)
- [x] Split `schema.prisma` and `schema.ts` into domain-based files

---

## Parallelism Matrix (which sets can run together)

**Remaining sets:** W1 (partial), W2, W5 (partial — Slack only), W6 (partial)

Sets that **conflict** (share domain files):
- W1 + W2 (both touch `resolvers/*`, `useProjectData.ts`, `TaskDetailPanel.tsx`)
- W1 + W6 (both touch `useProjectData.ts`, `ProjectDetail.tsx`)

Sets that **can run in parallel** (no file overlap):
- W1 (API refactor) + W5 (Slack) + W6 (views)
- W2 (task domain) + W5 (Slack) + W6 (views)
