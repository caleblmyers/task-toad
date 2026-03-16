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

## Priority Order

1. **P1 + P2** — Production & security hardening (blocks safe deployment)
2. **A11** — Accessibility (legal/compliance risk, user experience)
3. **Q1** — Code quality & testing (enables safe refactoring)
4. **W2** — Advanced tasks & filters (feature work)
5. **I1 + D1** — Integration completeness & observability
6. **F1** — Frontend performance (only matters at scale)
7. **S1** — Styling & branding (brand tokens deployed, remaining items are polish)
8. **SW1** — Swarm workflow & knowledge base optimization (meta — improves all future waves)

---

## Work Sets — Uncompleted

### P1: Production Hardening (High Priority)
**Touches:** `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/web/src/App.tsx`

- [ ] Sentry error tracking integration — capture unhandled exceptions, GraphQL errors, and AI failures

### P2: Security Hardening (High Priority)
**Touches:** `apps/api/src/graphql/schema.ts`, `apps/api/src/app.ts`

- [ ] GraphQL query complexity/cost limits — add `costLimit` plugin to prevent expensive queries (depth limit done, complexity not yet)

### A11: Accessibility Foundation (High Priority)
**Touches:** `apps/web/src/components/`

- [ ] Color contrast audit — full WCAG AA 4.5:1 audit of remaining Tailwind color pairings across all components
- [ ] KanbanBoard reorder persistence — Up/Down reorder is local state only; needs a `reorderTask` mutation to persist order to DB
- [ ] BacklogView sprint picker: close on Escape key and click-outside for better keyboard UX

### Q1: Code Quality & Testing (Medium Priority)
**Touches:** `apps/web/src/hooks/`, `apps/api/src/graphql/resolvers/`, `__tests__/` directories

- [ ] TypeScript strictness (final) — remaining `any` types audit; add Zod for suggestedTools and dependsOn JSON parsing in taskHelpers.ts
- [ ] Expand test coverage — add tests for useTaskCRUD, tokenEstimator, aiService, and resolver integration tests
- [ ] Integration test CI — tasktoad_test database needs to be created/available in CI; add docker-compose or GitHub Actions step for test DB
- [ ] Integration test coverage — extend beyond auth to task CRUD, sprint, project resolvers

### W2: Advanced Tasks & Filters
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/task.ts`, `TaskDetailPanel.tsx`, `useProjectData.ts`, `useTaskFiltering.ts`, `FilterBar.tsx`

- [ ] Recurring tasks — auto-recreate on schedule. Full slice: Prisma fields (recurrenceRule, recurrenceParentId), cron/scheduler utility, creation logic, UI toggle in TaskDetailPanel
- [ ] File attachments on tasks — upload images/docs/screenshots. Full slice: storage service abstraction (local + S3), Prisma model (Attachment), upload endpoint, TaskDetailPanel attachment section
- [ ] Shared types between API and web — evaluate graphql-codegen or shared package for type safety

### W6: Advanced Views & AI Extras (remaining)
**Touches:** `resolvers/ai.ts`, `apps/web/src/components/`

- [ ] AI auto-review trigger — auto-trigger review when task moves to `in_review` status (currently manual button only)
- [ ] API docs operation descriptions — extract descriptions from SDL comments for each query/mutation (currently shows signature only)

### D1: Deployment & Observability (Medium Priority)
**Touches:** `apps/api/src/app.ts`, `apps/api/src/index.ts`, Railway dashboard config

- [ ] External uptime monitoring (Uptime Robot or similar)
- [ ] Railway alerting — configure alerts for restart loops, memory spikes, high CPU
- [ ] Staging environment — Railway preview deployments from PRs
- [ ] Database backup strategy — verify Railway PostgreSQL automated backups, document restore procedure

### I1: Integration Completeness (Medium Priority)
**Touches:** `apps/api/src/utils/webhookDispatcher.ts`, `apps/api/src/slack/`, `apps/api/src/github/`

- [ ] Slack user mapping discovery — `/tasktoad link` self-service command for users to link their own accounts (currently admin-only via UI)
- [ ] GitHub webhook retry — dead letter queue for failed webhook processing with manual replay

### F1: Frontend Performance (Low-Medium Priority)
**Touches:** `apps/web/src/components/`, `apps/api/src/graphql/resolvers/project.ts`

- [ ] Virtualize long lists — use `react-window` or `@tanstack/virtual` for task lists (BacklogView, TableView) and activity feeds when > 100 items
- [ ] dependsOnCache memory management — parseDependsOn in taskHelpers.ts uses a module-level Map that never clears; add TTL or WeakRef-based eviction if task counts grow large
- [ ] Template dropdown click-outside close — ProjectDetail template menu doesn't close on click-outside, only via Close button
- [ ] Template instructions/acceptanceCriteria in create UI — createTaskTemplate form only has name/description/priority/type but the model supports instructions and acceptanceCriteria fields
- [ ] Route lazy-load error boundaries — React.lazy chunks can fail to load (network issues); add retry logic or per-route error boundaries with refresh prompt
- [ ] Lazy-load heavy view components — GanttChart, BatchCodeGenModal, DriftAnalysisModal with `React.lazy()` (route-level lazy loading done, but these in-page modals still eagerly loaded)

### S1: Styling & Branding
**Touches:** `apps/web/src/components/shared/`, `apps/web/tailwind.config.js`, `apps/web/index.html`, `apps/web/public/`

- [ ] Consistent spacing/typography scale — audit and normalize padding, margin, font-size usage across components
- [ ] Dark mode rollout — extend dark: variants to remaining components (ProjectDetail, modals, cards, tables, forms); add user-facing toggle with localStorage persistence
- [ ] Button component adoption — ~26 remaining ad-hoc buttons not yet converted (cancel buttons, login/signup submit, some one-off styles)
- [ ] SVG favicon — generate proper SVG favicon from T-Frog silhouette for sharp rendering at all sizes
- [ ] Social preview image — proper og:image composite (logo + text on brand-dark background) for link sharing
- [ ] PWA manifest — `manifest.json` with icon set for installable web app

### SW1: Swarm Workflow Optimization (Meta)
**Touches:** `.claude/skills/`, `.claude-knowledge/`, `scripts/swarm/`, `CLAUDE.md`

- [ ] Auto-prisma-generate in merge script — `scripts/swarm/merge-worker.sh` should detect Prisma schema changes in the diff and run `npx prisma generate` automatically before typecheck, preventing the recurring "stale Prisma client types" review rejection
- [ ] Task file array validation — add a pre-flight check in the swarm skill that cross-references task description file paths against the `files` array, flagging any mentioned files that aren't listed (recurring issue: Prisma relation files, resolver index, entry point files)
- [ ] Auto-strip worker role from CLAUDE.md commits — swarm setup appends worker role to CLAUDE.md but workers accidentally commit it; need .gitignore or pre-commit hook to strip the role section before commit

---

## Parallelism Matrix

**Can run in parallel (no file overlap):**
- P1 (production) + A11 (accessibility) + I1 (integrations)
- P2 (security) + S1 (styling) + D1 (deployment)
- Q1 (code quality) + I1 (integrations) + F1 (performance)
- W2 (tasks/filters) + any non-W set

**Conflicts:**
- P1 + P2 (both touch `app.ts`)
- P1 + D1 (both touch `app.ts`, `index.ts`)
- A11 + Q1 (both touch components — but A11 is UI-level, Q1 is structural; could be split carefully)
- A11 + S1 (both touch component styling)

**Remaining legacy sets (W2, W6):** Can run in parallel with each other — no file overlap.

**SW1 (meta):** No code file overlap with any set — only touches skills, scripts, docs. Can run alongside anything, or be done manually between waves.

---

## Completed

### S1+Q1+W6 (partial): Wave 13 (2026-03-16)
- [x] Shared Button component — primary/secondary/ghost/danger variants, sm/md/lg sizes, loading spinner, forwardRef; 31 buttons converted
- [x] Dark mode infrastructure — Tailwind darkMode: 'class', .dark CSS vars, dark: on layout shell + Button + Modal
- [x] Integration test foundation — tasktoad_test DB setup, cleanDatabase(), auth resolver tests (signup/login/createOrg)
- [x] Zod validation for JSON.parse — zodSchemas.ts with 4 schemas, 7 bare casts replaced with safeParse + fallbacks
- [x] AI code review UI — TaskAIReviewSection component, review button on tasks with linked PRs, useTaskCRUD wiring
- [x] Enhanced API docs — domain-grouped ops, rate limits, Quick Start, sidebar, schema.graphql + schema.json endpoints

### F1 (partial): Frontend Performance (Wave 12, 2026-03-16)
- [x] React.memo on TaskRow, CommentItem, ActivityItem with stable useCallback props
- [x] parseDependsOn cache utility in taskHelpers.ts — KanbanBoard + GanttChart use cached JSON parsing
- [x] Route lazy-loading — ProjectDetail, Portfolio, OrgSettings, Search, NewProject, Projects, ProfilePage via React.lazy
- [x] portfolioOverview N+1 fix — batched from 1+2N queries to 3 total queries

### W2 (partial): Task Templates + JSON Helpers + Field Reorder (Wave 12, 2026-03-16)
- [x] TaskTemplate Prisma model, GraphQL CRUD, template picker in ProjectDetail toolbar, Save as Template, management tab in ProjectSettingsModal
- [x] JSON column helpers — parseColumns/parseOptions/parseStatuses in jsonHelpers.ts, 10 call sites replaced
- [x] Custom field reordering UI — Up/Down arrow buttons with position swap via updateCustomField mutation

### SW1 (partial): Swarm Meta (Wave 12, 2026-03-16)
- [x] CLAUDE.md refreshed with current queries/mutations, key files, endpoints, env vars
- [x] Knowledge base audit — app-overview.md, skills.md, decisions.md updated for Waves 9-11
- [x] Swarm status dashboard file overlap warnings in status.sh
- [x] Worker branch strategy documented in BRANCH_STRATEGY.md
- [x] Standard Prisma + npm package acceptance criteria reminders in swarm SKILL.md

### P1+D1 (partial): Production Infra & Observability (Wave 11, 2026-03-16)
- [x] Prisma connection pooling documented, LOG_LEVEL env var, pino-http structured request logging with request IDs
- [x] Health check endpoint (GET /api/health) with DB probe, Dockerfile HEALTHCHECK
- [x] Prometheus metrics endpoint (GET /api/metrics) with request latency histograms, Prisma pool stats, Node.js default metrics

### Q1 (partial): Code Quality & Testing (Wave 11, 2026-03-16)
- [x] Vitest setup for API + web with TypeScript support
- [x] Unit tests for resolverHelpers (validateStatus, parseInput, sanitizeForPrompt) and useTaskFiltering (8 test scenarios)
- [x] Error handling audit — NotificationCenter, GlobalSearchModal, FilterBar catch blocks now log/show errors
- [x] export.ts any types replaced with Prisma-derived types
- [x] AppLayout dead SSE handler documented with TODO

### W2 (partial): Advanced Tasks & Filters (Wave 11, 2026-03-16)
- [x] Custom field DataLoader — customFieldValuesByTask with batched loading, registered in context
- [x] customFieldValues added to TASK_FIELDS query constant
- [x] NUMBER/DATE filter controls in FilterBar with operator dropdowns + comparison logic in useTaskFiltering
- [x] Multiple assignees — TaskAssignee join table, GraphQL CRUD with DataLoader, multi-select chip picker UI

### P2 (partial): Security Hardening (Wave 10, 2026-03-16)
- [x] GraphQL query depth limit (max 10) — custom validation rule
- [x] Per-user SSE connection limit (max 5) — evicts oldest on overflow
- [x] Export rate limiting — 5 req/10min per IP
- [x] Bulk mutation per-project auth — bulkUpdateTasks verifies project access
- [x] SSE token moved to Authorization header — fetch-based client replaces EventSource
- [x] Comment mention hardening — tighter regex, 20 cap, batched lookups

### A11 (partial): Accessibility (Wave 10, 2026-03-16)
- [x] Form label associations — htmlFor/id pairs + aria-labels across 5 components
- [x] Color contrast fixes — text-slate-300/400 → text-slate-500 on light backgrounds
- [x] KanbanBoard Up/Down reordering — within-column task moves with aria-live announcements
- [x] BacklogView keyboard sprint moves — sprint picker dropdown accessible via M key

### I1 (partial): Integration Completeness (Wave 10, 2026-03-16)
- [x] HTML email templates wired — all 4 sendEmail calls pass HTML templates
- [x] Webhook retry processor wired — start/stop in server lifecycle
- [x] SSE shutdown cleanup — closeAllConnections in graceful shutdown
- [x] Email retry with backoff — 3 attempts (1s/5s/15s)
- [x] Slack user mapping — full vertical slice (Prisma, GraphQL, slash commands, settings UI)
- [x] Slack list assignee filtering — user-specific task lists for mapped users

### P1 (partial): Production Hardening (Wave 9, 2026-03-16)
- [x] Graceful shutdown handlers (SIGTERM/SIGINT) — close Prisma, clear intervals, force-kill timeout
- [x] Environment validation improvements — production warnings for missing SMTP, API keys
- [x] Static asset caching headers — immutable for hashed assets, no-cache for index.html
- [x] React Error Boundary — global error boundary with fallback UI and Suspense wrapper

### A11 (partial): Accessibility Foundation (Wave 9, 2026-03-16)
- [x] Shared Modal component — focus trap, aria-modal, aria-labelledby, Escape-to-close, focus restore; 19 modals converted
- [x] ARIA labels on icon-only buttons — all close/clear/dismiss buttons, 22 SVG icons with aria-hidden
- [x] Screen reader live regions — ToastContainer with aria-live, error toasts with role="alert"
- [x] Skip-to-content link — sr-only visible on focus, jumps to #main-content
- [x] KanbanBoard keyboard navigation — Enter/Space move mode, arrow keys between columns, Escape to exit

### I1 (partial): Integration Completeness (Wave 9, 2026-03-16)
- [x] Webhook retry queue — WebhookDelivery model, exponential backoff (5s→1hr, 5 attempts), background processor
- [x] Webhook delivery dashboard — per-endpoint delivery history UI with status badges and replay button
- [x] Slack command expansion — `/tasktoad list` and `/tasktoad status` with Block Kit formatting
- [x] Email HTML templates — branded templates for verification, password reset, invite

### W1 (partial): API Refactor & Security Hardening (Wave 7, 2026-03-16)
- [x] Extract `requireTask`/`requireProject` resolver utilities — eliminated 20+ duplicated validation blocks
- [x] Extract `validateStatus` utility — deduplicated from task.ts
- [x] Add GraphQL error codes (`ERR_NOT_FOUND`, `ERR_VALIDATION`, etc.) in error extensions
- [x] Add Zod input validation at resolver boundaries (title, description, comment length limits)
- [x] Wrap `commitTaskPlan` Promise.all with error handling
- [x] Sanitize `appendToTitles` in AI prompts
- [x] Add string length limits at resolver boundaries
- [x] Rate-limit password reset and email verification endpoints
- [x] Add Content-Security-Policy headers via helmet config

### W1 (partial): Frontend Cleanup (Wave 7, 2026-03-16)
- [x] Decompose BacklogView — extracted BacklogSection component
- [x] Lazy-load react-markdown + remark-gfm with Suspense
- [x] Replace direct setState injection in useSprintManagement with action callbacks

### W5: Slack Integration (Wave 7, 2026-03-16)
- [x] SlackIntegration Prisma model with migration
- [x] Slack client service with Block Kit message formatting
- [x] Slack notification dispatch (fire-and-forget alongside webhooks)
- [x] Slash command endpoint (`POST /api/slack/commands`) for task creation
- [x] GraphQL CRUD (connectSlack, updateSlackIntegration, disconnectSlack, testSlackIntegration)
- [x] SlackSettings UI in OrgSettings

### W6 (partial): Views & AI History (Wave 7, 2026-03-16)
- [x] Timeline / Gantt view — SVG chart with dependency arrows, day/week/month zoom
- [x] Portfolio overview page — cross-project metrics with health scores
- [x] AI prompt history — AIPromptLog model, automatic persistence, task detail UI
- [x] Historical trend analysis — analyzeTrends query with TrendAnalysisPanel

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
