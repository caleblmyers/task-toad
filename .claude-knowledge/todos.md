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

### W1: Full-Stack Quality Refactor
**Touches:** `useProjectData.ts`, `TaskDetailPanel.tsx`, `BacklogView.tsx`, `KanbanBoard.tsx`, `ProjectDetail.tsx`, `resolvers/*`, `typedefs/*`, `context.ts`, `utils/`, `promptBuilder.ts`, `app.ts`
**Est. time:** 60 min per worker (split across 2-3 workers if needed)

**Frontend architecture:**
- [ ] Split `useProjectData.ts` (~1150 lines, 37 useState, 40+ functions) into focused hooks: `useTasks()`, `useSprintManagement()`, `useAIGeneration()`, `useProjectUI()` — current god-object causes excessive re-renders and prop drilling
- [ ] Decompose `TaskDetailPanel.tsx` (~780 lines, 73+ props) — extract `TaskTitleEditor`, `TaskFieldsPanel`, `GitHubTaskSection`, `TaskPRSection`, `TaskCommitsSection` sub-components
- [ ] Decompose `BacklogView.tsx` (~533 lines) — extract `SprintSection` component with its own DnD logic
- [ ] Add `useMemo`/`useCallback` coverage — wrap mutation handlers, memoize KanbanBoard column grouping (O(tasks × columns) → Map), memoize blocked-task status (O(n²) → Map)
- [ ] Extract GraphQL query strings from `useProjectData` into `queries.ts` with typed constants
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

### W3: Users, Roles & Automation
**Touches:** `prisma/schema/auth.prisma`, `prisma/schema/` (new models), `typedefs/auth.ts`, `typedefs/` (new files), `resolvers/auth.ts`, `context.ts`, `resolvers/*`, new frontend components, new automation engine
**Est. time:** 45-60 min

- [ ] User avatars — upload/set profile avatar, display on task cards, board, comments, and assignee dropdowns. Full slice: avatar field on User, upload endpoint or Gravatar integration, avatar rendering component, display everywhere users appear
- [ ] Profile management — edit display name, timezone, notification prefs from user settings page. Full slice: new fields on User (displayName, timezone), profile page component, updateProfile mutation
- [ ] Project-level roles — per-project access control (viewer, editor, admin). Full slice: ProjectMember Prisma model with role field, permission checks in resolvers via context helper, invite-to-project UI, role management in project settings
- [ ] Automation rules — configurable triggers (e.g. "when Done → notify assignee", "when assigned → move to In Progress"). Full slice: AutomationRule Prisma model, rule evaluation engine (runs on task/sprint mutations), rule builder UI in project settings

### W4: AI Power Features
**Touches:** `ai/*`, `resolvers/ai.ts`, `typedefs/ai.ts`, `typedefs/task.ts`, `github/*`, new frontend components/modals
**Est. time:** 45-60 min

- [ ] Deduplicate "add more tasks" — prevent AI task generation from creating duplicate tasks. Full slice: fetch existing titles in resolver, inject into prompt as exclusion list (cap at 30), post-generation case-insensitive dedup filter, apply to both `previewTaskPlan` and `expandTask`
- [ ] Bug report → Task — AI parses bug report into structured task. Full slice: Zod schema (BugReportTask), prompt builder, service function, `parseBugReport` mutation, BugReportModal component with textarea + submit, toolbar button in ProjectDetail
- [ ] PRD → Task breakdown — AI breaks PRD into epics/tasks. Full slice: Zod schema (PRDBreakdown with nested epics/tasks), prompt builder, service, preview/commit mutation pair (like task plans), PRDBreakdownModal with preview + commit flow, toolbar button
- [ ] Sprint transition analyzer — AI analyzes backlog on sprint close. Full slice: Zod schema (SprintTransition with carryOver/deprioritize/recommendations), prompt builder, service, `analyzeSprintTransition` query, UI integration in sprint close flow
- [ ] GitHub repo → Project bootstrap — import existing repo, AI analyzes codebase to auto-generate project with initial tasks. Full slice: fetch repo file tree + README + package.json via GitHub API, prompt builder for codebase analysis, service function, `bootstrapProjectFromRepo` mutation, UI in new project flow

### W5: External Integrations & Real-time
**Touches:** `prisma/schema/org.prisma`, `typedefs/org.ts`, new backend services, `OrgSettings.tsx`, `app.ts`, new client-side hooks
**Est. time:** 45-60 min

- [ ] Slack integration — channel notifications for task events, create tasks from Slack. Full slice: Prisma model (SlackIntegration with webhookUrl, channelId), Slack webhook client service, notification utility integration (send to Slack when creating notifications), slash command endpoint for task creation, OrgSettings UI for connecting Slack workspace
- [ ] Webhook support — outgoing webhooks on task/sprint/comment events. Full slice: Prisma model (WebhookEndpoint with url, events[], secret), webhook dispatch service with HMAC signing, fire-and-forget delivery on mutations, retry queue with exponential backoff, OrgSettings UI for managing endpoints, test webhook button
- [ ] Real-time updates (websockets or SSE) — push task/sprint/comment changes to all connected clients. Full slice: SSE endpoint in `app.ts` with auth, event emitter service that mutations call after DB writes, client-side `useEventSource` hook that patches local state on events, reconnection logic with exponential backoff

### W6: Advanced Views & AI Extras
**Touches:** new `apps/web/src/components/` files, `ProjectDetail.tsx`, `useProjectData.ts`, `ai/*`, `resolvers/ai.ts`
**Est. time:** 45-60 min

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies. Full slice: GanttChart component with SVG rendering, task bars positioned by start/due date, dependency arrows, zoom/scroll, integrated as new view tab in ProjectDetail
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts. Full slice: `portfolioOverview` query aggregating stats across projects, Portfolio page component with project cards showing health scores and progress bars, route in App.tsx
- [ ] Public REST/GraphQL API docs — documented API for third-party use. Full slice: auto-generate from GraphQL schema using graphql-markdown or similar, serve at `/api/docs`, add auth token instructions
- [ ] Repo ↔ Task drift analysis — AI compares repo state (commits, PRs, file changes) against task set to flag outdated/untracked work. Full slice: Zod schema, prompt builder using repo context, `analyzeRepoDrift` query, results panel in ProjectDetail
- [ ] Contextual project chat — NL Q&A grounded in live project data. Full slice: chat UI component, `projectChat` mutation that injects project/task/sprint context into AI prompt, conversation history state, streaming response support
- [ ] Historical summary analysis — trend analysis over persisted reports. Full slice: query past reports, prompt builder for trend analysis, `analyzeTrends` query, trend chart component
- [ ] Batch code generation — generate code for multiple related tasks in one PR. Full slice: multi-task selection UI, prompt that includes all selected tasks, single PR creation with all generated files
- [ ] Prompt replay / history — save AI prompts + responses per task for debugging and cost tracking. Full slice: Prisma model (AIPromptLog with input/output/tokens/cost), persist in AI service layer, UI panel in task detail showing prompt history

---

## Completed

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

Sets that **conflict** (share domain files):
- W1 + W2 (both touch `resolvers/*`, `useProjectData.ts`, `TaskDetailPanel.tsx`)
- W1 + W6 (both touch `useProjectData.ts`, `ProjectDetail.tsx`)
- W2 + W4 (both touch `typedefs/task.ts` if AI features add task fields)

Sets that **can run in parallel** (no file overlap):
- W1 (frontend/API refactor) + W5 (external integrations) + W4 (AI features — if scoped to `ai/*` only)
- W2 (task domain) + W3 (auth domain) + W5 (org domain)
- W3 (auth/roles) + W4 (AI) + W5 (external)
- W4 (AI) + W5 (external) + W6 (views — if AI portions don't overlap)
