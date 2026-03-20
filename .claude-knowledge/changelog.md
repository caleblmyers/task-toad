# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-20 (auto-complete redesign)

### Wave 36: Auto-Complete Redesign — Foundation: Schema + Retrieval (3 tasks)

**Task 1-A — Knowledge Base Schema + CRUD:**
- New `KnowledgeEntry` model (`knowledgebase.prisma`): uuid PK, projectId, orgId, title, content (Text), source, category, timestamps
- GraphQL CRUD: `knowledgeEntries` query, `createKnowledgeEntry`/`updateKnowledgeEntry`/`deleteKnowledgeEntry` mutations
- Resolvers with `requireProject` + `MANAGE_PROJECT_SETTINGS` permission, input validation for source/category
- `knowledgeEntriesByProject` DataLoader in `loaders.ts`
- Relations added to Project and Org models
- `KnowledgeEntry` interface in shared-types
- Migration: `20260320040000_add_knowledge_entries_autocomplete_informs`

**Task 1-B — Knowledge Base Retrieval Function:**
- `retrieveRelevantKnowledge()` in `ai/knowledgeRetrieval.ts`: if ≤3 entries returns all, otherwise sends titles to Claude to pick top 5-8, fetches full content for selected
- `buildKnowledgeRetrievalPrompt()` prompt builder
- `KnowledgeRetrievalResponseSchema` Zod schema in aiTypes.ts
- `knowledgeRetrieval` added to AIFeature type + FEATURE_CONFIG (512 tokens, no cache)
- Graceful fallback: returns top 3 entries on AI failure

**Task 1-C — autoComplete Flag + informs Link Type:**
- `autoComplete Boolean @default(false)` added to Task model
- `informs` added to `DependencyLinkType` enum (typedefs + shared-types)
- `autoComplete` added to Task type, updateTask args/data, TASK_FIELDS
- `informs` added to validLinkTypes in addTaskDependency (cycle detection correctly skips non-blocking types)
- Frontend: `informs: 'Informs'` added to `TaskDependenciesSection.tsx` label map

---

## 2026-03-20 (security wave)

### Wave 35: Critical Security Fixes (3 workers, 3 tasks)

**Worker 1 — C-1: Token Revocation:**
- Added `tokenVersion` field to User model (Prisma migration)
- JWT payload now includes `tv` (tokenVersion) claim
- `buildContext` validates tokenVersion — stale tokens rejected, backward compat for old tokens
- New `logout` mutation increments tokenVersion, invalidating all sessions
- `resetPassword` also increments tokenVersion (H-11)
- Frontend logout calls mutation before clearing localStorage

**Worker 2 — C-2 + C-4 + C-5: Multi-Tenant Isolation:**
- Export endpoints: added `orgId` to all 4 Prisma WHERE clauses (defense-in-depth)
- `aiPromptHistory`: validates projectId/taskId access via `requireProjectAccess`
- `automationRules`: added orgId to query WHERE clause
- `updateAutomationRule`/`deleteAutomationRule`: verify `rule.orgId === user.orgId`

**Worker 3 — C-3 + H-5 + H-7 + H-8: SSRF + Quick Highs:**
- New `urlValidator.ts` with DNS resolution, private IP blocking, protocol/port checks
- Wired into webhook create/update/test endpoints
- `app.set('trust proxy', 1)` for correct rate limiting behind Railway proxy
- `frameAncestors: ["'none'"]` added to Helmet CSP
- SSE `?token=` query string fallback removed

**Process:** All 3 tasks merged cleanly. No rejections.

**Security findings resolved:** C-1, C-2, C-3, C-4, C-5 (all Critical), H-5, H-7, H-8, H-11 (4 High). 9 of 39 findings fixed.

---

## 2026-03-20 (night)

### Wave 34: Cleanup & Hardening (3 workers, 5 tasks)

**Worker 1 — Centralize GraphQL Queries:** Extracted ~90 inline queries from 35+ files into `queries.ts`.

**Worker 2 — ARIA Audit + Task Detail Re-Architecture:** TaskDetailPanel refactored into 4-tab layout, aria-live regions, semantic buttons, skip-to-content link, focus trap verification.

**Worker 3 — Permission Scheme:** Permission enum (22 permissions), ROLE_PERMISSIONS mapping, requirePermission helper, resolver guards, myPermissions query, frontend PermissionContext + permission-aware UI.

**Process:** All 5 tasks merged. One rejection each on task-003 and task-005 (merge conflicts).

---

## 2026-03-20 (late)

### Wave 33: Hierarchy + User Capacity + Compound Filters (3 workers, 5 tasks)

**Worker 1 — Multi-Level Hierarchy:** Recursive EpicsView tree, breadcrumb navigation, initiative taskType, recursive descendant progress.

**Worker 2 — User Capacity:** UserCapacity + UserTimeOff models, teamCapacitySummary query, sprint planner integration, TeamCapacityPanel frontend.

**Worker 3 — Compound Filters:** FilterGroupInput with AND/OR, recursive Prisma translator, depth/count validation, FilterBuilder UI.

**Other:** Removed placeholder images, ANTHROPIC_API_KEY env var cleanup, deployment checklist added.

---

## 2026-03-20

### Wave 32: Cumulative Flow + Time Tracking + Saved Views (3 workers, 6 tasks)

**Worker 1 — Charts & Portfolio:** cumulativeFlow query + SVG stacked area chart, portfolioRollup query + Portfolio stat cards.

**Worker 2 — Time Tracking:** TimeEntry model, CRUD, task/sprint summaries, frontend time log UI + sprint time summary.

**Worker 3 — Saved Views:** Extended SavedFilter with view config fields, SavedViewPicker with shared views, ProjectToolbar wiring.

**Other:** SSEProvider context fix, ANTHROPIC_API_KEY removal.

---

## 2026-03-19 (evening)

### Wave 31: Task Watchers + WIP Limits + Release Model (3 workers, 6 tasks)

**Worker 1 — Task Watchers:** TaskWatcher join table, auto-watch on create/assign/mention, watcher notifications, Watch/Unwatch UI.

**Worker 2 — WIP Limits + Cycle Time Filter:** wipLimits JSON on Sprint, KanbanBoard warnings, SprintCreateModal inputs, CycleTimePanel date pickers.

**Worker 3 — Release Model:** Release + ReleaseTask models, CRUD, AI release notes, frontend list/detail/modal + Releases tab.

---

## Older Entries (one-line summaries)

- **2026-03-19** — Waves 28-30: codebase cleanup (dead code, decomposition), dependency graph, cycle time metrics, server-side filtering, workflow transitions, kanban swimlanes. Plus swarm tooling improvements and CI fixes.
- **2026-03-18** — Wave 30 execution. Server-side task filtering, workflow transition model + config UI, dependsOn→TaskDependency migration, kanban swimlanes.
- **2026-03-17** — Waves 22-27: GitHub integration (repo linking, PR creation, issue decomposition), Slack integration, webhook system, notification preferences, dark mode, PWA, S3 file attachments, responsive layout, focus trap extraction, SSE real-time.
- **2026-03-16** — Waves 14-21: Sentry integration, lazy loading, code splitting, unit/integration tests, CI pipeline, file attachments, recurring tasks, accessibility audit, dark mode contrast fixes, shared-types package, action plan pipeline improvements.
- **2026-03-14** — Waves 8-13: AI code generation, GitHub PR creation, action plan pipeline, AI caching, prompt logging, task templates, multiple assignees, custom fields, saved filters, Prometheus metrics, structured logging.
- **2026-03-13** — Waves 4-7: Sprint model, kanban board, backlog view, AI task planning, notification system, SSE real-time events, comment @mentions, project export (CSV/JSON).
- **2026-03-12** — Waves 1-3: Initial build. Express + graphql-yoga + Prisma setup, HMAC JWT auth, React frontend, task CRUD, project CRUD, org management, security hardening (helmet, CORS, rate limiting), generation UX (skeletons, progress, abort).
