# Remaining Work

All original work sets completed through Wave 30. Competitive gap items ongoing. Completed items are in `changelog.md`.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Wave 35 — Critical Security Fixes — Completed (2026-03-20)

- [x] C-1: Token revocation — tokenVersion on User, JWT tv claim, buildContext validation, logout mutation, resetPassword invalidation, frontend logout (task-001, worker-1)
- [x] C-2 + C-4 + C-5: Multi-tenant isolation — orgId in export queries, aiPromptHistory access checks, automationRules orgId scoping (task-002, worker-2)
- [x] C-3 + H-5 + H-7 + H-8: SSRF protection — URL validator with DNS resolution + private IP blocking, trust proxy, CSP frame-ancestors, SSE token fallback removed (task-003, worker-3)

## Wave 34 — Query Centralization + ARIA + Permissions — Completed (2026-03-20)

- [x] Centralize inline GraphQL queries — settings & integration components (task-001, worker-1)
- [x] Centralize inline GraphQL queries — hooks, pages & remaining components (task-002, worker-1)
- [x] ARIA audit + TaskDetailPanel tabbed layout (task-003, worker-2)
- [x] Permission scheme — backend: Permission enum, requirePermission, resolver guards (task-004, worker-3)
- [x] Permission scheme — frontend: usePermissions hook, PermissionContext, permission-aware UI (task-005, worker-3)

### Follow-ups from Wave 34
- [ ] Frontend: disable task field editing (description, fields, status) when user lacks EDIT_TASKS permission (backend enforces it, but UI doesn't grey out)
- [ ] Add keyboard navigation (Enter/Space to select task) to BacklogView task rows (SprintSection already has it)
- [ ] ~3 dynamic mutations remain inline in useTaskOperations.ts — document or extract if patterns stabilize
- [ ] SavedViewPicker lint warning: setState in useEffect (pre-existing, not from this wave)

## Wave 33 — Hierarchy + User Capacity + Compound Filters — Completed (2026-03-20)

- [x] Multi-level hierarchy — recursive EpicsView tree, breadcrumbs, initiative taskType, recursive progress (task-001, worker-1)
- [x] User capacity — backend: UserCapacity + UserTimeOff models, sprint planner integration (task-002, worker-2)
- [x] User capacity — frontend: TeamCapacityPanel, sprint planning modal integration (task-003, worker-2)
- [x] Compound filter expressions — backend: FilterGroup recursive Prisma translation, validation (task-004, worker-3)
- [x] Compound filter expressions — frontend: FilterBuilder UI with AND/OR grouping (task-005, worker-3)

## Wave 32 — Cumulative Flow + Time Tracking + Saved Views — Completed (2026-03-20)

- [x] Cumulative flow diagram — backend query + SVG stacked area chart (task-001, worker-1)
- [x] Cross-project rollup metrics — portfolioRollup query + Portfolio page stat cards (task-002, worker-1)
- [x] Time tracking — backend: TimeEntry model, CRUD, task/sprint aggregates (task-003, worker-2)
- [x] Time tracking — frontend: time log UI in task detail, sprint time summary (task-004, worker-2)
- [x] Saved views — backend: extend SavedFilter with viewType/sortBy/groupBy/visibleColumns/isShared (task-005, worker-3)
- [x] Saved views — frontend: SavedViewPicker, save/load/share UI, ProjectToolbar integration (task-006, worker-3)

## Wave 31 — Task Watchers + WIP Limits + Release Model — Completed (2026-03-19)

- [x] Task watchers — backend: Prisma model, GraphQL CRUD, DataLoader, auto-watch, notifications (task-001, worker-1)
- [x] Task watchers — frontend: UI, hooks, Watch/Unwatch toggle (task-002, worker-1)
- [x] WIP limits — full stack: Sprint model, KanbanBoard warnings, SprintCreateModal UI, soft enforcement (task-003, worker-2)
- [x] Cycle time date range filter UI — date pickers, presets, validation (task-004, worker-2)
- [x] Release model — backend: Prisma schema, GraphQL CRUD, task association, AI release notes (task-005, worker-3)
- [x] Release model — frontend: list panel, detail panel, modal, Releases tab (task-006, worker-3)

## Wave 30 — Server-side Filtering + Workflow Transitions + Kanban Swimlanes — Completed (2026-03-18)

- [x] Server-side task filtering — backend (task-001, worker-1)
- [x] Server-side task filtering — frontend integration (task-002, worker-1)
- [x] Workflow transition model — backend + dependency warning surfacing (task-003, worker-2)
- [x] Workflow transition config UI + warning display (task-004, worker-2)
- [x] dependsOn data migration + OrgSettings lint fix (task-005, worker-3)
- [x] Kanban swimlanes — groupBy parameter (task-006, worker-3)

## Wave 29 — Dependency Graph + Metrics + Cleanup — Completed (2026-03-18)

- [x] Task dependency graph — backend model + GraphQL API (task-001, worker-1)
- [x] Task dependency graph — frontend + AI integration (task-002, worker-1)
- [x] Cycle time and lead time metrics query + frontend (task-003, worker-2)
- [x] Dead query cleanup + useFormState adoption in OrgSettings (task-004, worker-2)
- [x] useFormState adoption in SlackSettings + WebhookSettings (task-005, worker-3)
- [x] useFormState adoption in settings tabs + NotificationSettings (task-006, worker-3)

## Wave 28 — Codebase Cleanup — Completed (2026-03-18)

- [x] API dead code + promptBuilder decomposition (task-001, worker-1)
- [x] Decompose ai.ts resolver + fix type casts (task-002, worker-2)
- [x] Web dead code removal + useAIGeneration slim-down (task-003, worker-3)
- [x] Decompose ProjectSettingsModal into tab components (task-004, worker-3)
- [x] Decompose task.ts resolver (task-005, worker-1)
- [x] Decompose useTaskCRUD + useProjectData hooks (task-006, worker-3)
- [x] Add User orgId index + extract useFormState hook (task-007, worker-2)

---

## Remaining Cleanup

### Dead Code
- [x] Delete unused query constants from queries.ts (Wave 29, task-004)

### Duplication Reduction (large scope)
- [x] Centralize inline GraphQL queries (~90 queries across 35+ files → `queries.ts`). *(Wave 34, tasks 001-002)*
- [x] Adopt `useFormState` hook in settings components (Wave 29, tasks 004-006)

### Lint Warnings
- [x] Fix lint warning in OrgSettings.tsx:136 (Wave 30, task-005)

### Remaining Polish
- [x] ARIA audit — tabbed TaskDetailPanel, aria-live regions, skip-to-content link, click-div→button, icon-only labels, focus trap verification. *(Wave 34, task-003)*
- [ ] Shared-types expansion — add Report type to `@tasktoad/shared-types`
- [ ] S3 multipart upload — current 10MB limit uses single PUT; implement multipart for larger files
- [ ] useAsyncData adoption — migrate other components with inline fetch-in-useEffect patterns
- [x] Task detail re-architecture — 4-tab layout (Details, Activity, Relations, Actions) with aria-labelledby sections. *(Wave 34, task-003)*
- [ ] Release burndown chart — show task completion progress over time for a release (reuse existing chart patterns)
- [ ] Unit tests for `urlValidator.ts` — test private IP ranges, DNS resolution mocking, protocol/port blocking, edge cases (IPv4-mapped IPv6, DNS rebinding)

### Beta Scope — Known Limitations (not planned)
- Project-level access control — org-level read access for beta. Project-level RBAC deferred to post-beta.
- Runner / autonomous execution — aspirational, never built. TaskToad is AI-assisted, not autonomous.

---

## Security Audit — Action Items

Full report: `.claude-knowledge/security-audit.md` (2026-03-20, 39 findings)

### Phase 1 — Critical (Fix Immediately)

These are active vulnerabilities in the deployed production app.

- [x] **C-1: Token revocation + logout** — ✅ Wave 35. Added tokenVersion to User, JWT tv claim, buildContext validation, logout mutation, resetPassword invalidation, frontend integration.
- [x] **C-2: Multi-tenant data leak in exports** — ✅ Wave 35. Added `orgId` to all 4 Prisma WHERE clauses in export.ts.
- [x] **C-3: SSRF via webhook URLs** — ✅ Wave 35. Added `urlValidator.ts` with DNS resolution, private IP blocking, protocol/port checks. Wired into webhook create/update/test.
- [x] **C-4: AI prompt history IDOR** — ✅ Wave 35. Added requireProjectAccess validation for taskId and projectId filters.
- [x] **C-5: Automation rules leak across tenants** — ✅ Wave 35. Added orgId to query WHERE clause and ownership checks in update/delete mutations.

### Phase 2 — High (Swarm Wave: Auth Hardening)

Dedicate a swarm wave to auth architecture changes + remaining High items.

- [ ] **H-1: JWT in localStorage → HttpOnly cookies** — Migrate to `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Short-lived access tokens (15-30 min) + refresh token rotation. *(Full auth rework: client.ts, context.ts, auth.ts, App.tsx)*
- [ ] **H-2: CSRF protection** — Require custom header (`X-Requested-With`) on all mutations, or implement CSRF tokens. *(File: app.ts)*
- [ ] **H-3: Encrypt webhook secrets at rest** — Use existing `encryption.ts` AES-256-GCM for `WebhookEndpoint.secret`. *(File: webhook.prisma, webhook resolvers)*
- [ ] **H-4: Encrypt Slack webhook URLs at rest** — Use existing encryption utility. *(File: slack.prisma, slack resolvers)*
- [x] **H-5: Trust proxy for rate limiting** — ✅ Wave 35. Set `app.set('trust proxy', 1)` in app.ts.
- [ ] **H-6: Pagination caps on list queries** — Enforce `Math.min(args.limit ?? 50, 100)` on all list resolvers. *(Files: search.ts, notification.ts, webhook.ts, and others)*
- [x] **H-7: CSP frame-ancestors** — ✅ Wave 35. Added `frameAncestors: ["'none'"]` to Helmet CSP config.
- [x] **H-8: Remove SSE query string token fallback** — ✅ Wave 35. Removed `?token=` fallback from SSE endpoint.
- [ ] **H-9: Hash invite tokens before storage** — Use same `hashToken()` pattern as password reset tokens. *(File: auth.ts resolvers)*
- [ ] **H-10: Fix $queryRawUnsafe in advisory locks** — Switch to `prisma.$queryRaw` tagged template literals. *(File: advisoryLock.ts)*
- [x] **H-11: Password change invalidates sessions** — ✅ Wave 35. Handled as part of C-1 (resetPassword increments tokenVersion).
- [ ] **H-12: Re-authentication for sensitive operations** — Add `confirmPassword` argument to `setOrgApiKey` and other sensitive mutations. *(File: org.ts resolvers)*

### Phase 3 — Medium (Hardening Sprint)

- [ ] **M-1: Disable GraphQL introspection in production** — Check `NODE_ENV` in schema.ts. *(File: schema.ts)*
- [ ] **M-2: Per-org AI rate limiting** — Add per-org throttle (e.g., 5 AI requests/hour) beyond global rate limit. *(Files: ai resolvers)*
- [ ] **M-3: Content-Disposition header injection** — Use RFC 5987 encoding or `content-disposition` library for export filenames. *(File: export.ts)*
- [ ] **M-4: File upload magic byte validation** — Use `file-type` library instead of trusting client MIME type. *(File: upload.ts)*
- [ ] **M-5: Scope DataLoaders by orgId** — Add orgId parameter to DataLoader keys for tenant isolation. *(File: loaders.ts)*
- [ ] **M-6: Audit logging for sensitive operations** — Log `setOrgApiKey`, `createWebhookEndpoint`, `connectSlack`, `linkGitHubInstallation` with actor + timestamp. *(Various resolvers)*
- [ ] **M-7: Redact emails in exports by default** — Add `includeEmails` opt-in parameter to export endpoints. *(File: export.ts)*
- [ ] **M-8: Saved filter mutations skip orgId validation** — Validate filter's project belongs to user's org before update/delete. *(File: resolvers/project.ts)*
- [ ] **M-9: Input length validation on text fields** — Add Zod `.max()` constraints: title (200), description (10000). *(File: task/mutations.ts)*
- [ ] **M-10: Webhook replay prevention** — Add unique `X-Webhook-Delivery-ID` header to dispatched webhooks. *(File: webhookDispatcher.ts)*

### Phase 4 — Low (Individual Items)

- [ ] **L-1: Reduce JWT expiry to 1-2 hours + refresh tokens** — Depends on H-1 cookie migration. *(File: auth.ts)*
- [ ] **L-2: Email enumeration on signup** — Accept trade-off (common UX) or switch to silent success with confirmation email. *(File: auth.ts)*
- [ ] **L-3: URL-encode GitHub file paths** — Apply `encodeURIComponent(path)` in GitHub API calls. *(File: githubFileService.ts)*
- [ ] **L-4: Remove console.error in production ErrorBoundary** — Wrap with NODE_ENV check, route to Sentry. *(Files: ErrorBoundary.tsx, RouteErrorBoundary.tsx)*
- [ ] **L-5: Concurrent session limit** — Track sessions, allow user to view/terminate. *(Depends on C-1 tokenVersion)*
- [ ] **L-6: Unicode homograph attack in filenames** — NFKD normalize + ASCII-only whitelist. *(File: upload.ts)*
- [ ] **L-7: Bulk mutation item count limit** — Cap `bulkUpdateTasks` at 100 items. *(File: task/mutations.ts)*
- [ ] **L-8: Reduce GraphQL depth limit** — Lower from 10 to 6-7 after profiling legitimate queries. *(File: app.ts)*
- [ ] **L-9: SameSite cookie attribute** — Set `SameSite=Strict` when implementing cookie auth (depends on H-1). *(Future)*
- [ ] **L-10: Cap Retry-After parsing** — Max 1 hour wait to prevent self-DoS. *(File: githubAppClient.ts)*
- [ ] **L-11: Null byte stripping on REST endpoints** — Apply globally via Express middleware, not just GraphQL. *(File: app.ts)*
- [ ] **L-12: Test database credentials in CI/CD** — Require `TEST_DATABASE_URL` env var in CI. *(File: setup.integration.ts)*

---

## Deployment & Ops — Pre-Launch Checklist

### Infrastructure (Railway)
- [x] Railway project created (`blissful-insight`)
- [x] Postgres addon running (internal network: `postgres.railway.internal:5432`)
- [x] API service (`tasktoad-api`) deployed from GitHub repo, auto-deploys on push
- [x] Env vars configured: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_MASTER_KEY`, `CORS_ORIGINS`, `NODE_ENV=production`
- [x] GitHub App credentials configured: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
- [x] Railway public domain: `tasktoad-api-production.up.railway.app`
- [x] Frontend served as static files from API service (Express serves `web/dist` in production)
- [x] Health check passing: `/api/health` returns `status: ok, db: ok`
- [ ] Railway health check configured in service settings (auto-restart on failure)
- [ ] Custom domain configured (optional — Railway domain works for beta)

### Observability
- [x] Sentry DSN set on production (`SENTRY_DSN` env var added 2026-03-20)
- [ ] Verify Sentry receives errors in production (trigger a test error or wait for first real one)
- [ ] UptimeRobot monitor configured: HTTP check on production `/api/health` every 5 min

### Database
- [x] Prisma migrations applied (auto-run on deploy via build command)
- [ ] Verify all Wave 31-34 migration tables exist in production DB

### Email (optional for beta)
- [ ] SMTP provider configured (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
- [ ] Email verification and password reset flows tested

### Security Review
- [x] `JWT_SECRET` is strong random hex (not `dev-secret`)
- [x] `ENCRYPTION_MASTER_KEY` is random 64-char hex (not placeholder)
- [x] `CORS_ORIGINS` set to production domain only
- [x] No secrets committed to git

---

## Post-Deployment — Manual Testing Plan

Test against production: `https://tasktoad-api-production.up.railway.app`

### Test 1: Onboarding Flow
- [ ] Sign up with real email — verify error is graceful if SMTP not configured (no crash)
- [ ] Sign up, log in, create an org
- [ ] Set Anthropic API key in org settings — verify it saves, hint shows last 4 chars

### Test 2: Project Creation
- [ ] Create a project manually (name + description)
- [ ] "Generate Project Options" with AI — returns 3 options, pick one, preview task plan, commit
- [ ] Tasks appear in Backlog tab with correct statuses

### Test 3: Task Lifecycle
- [ ] Create task manually, edit title/description/priority/status
- [ ] Assign yourself, add due date, add story points
- [ ] Change status on Board tab (drag or dropdown) — verify status↔column sync
- [ ] Add comment with @mention — notification appears
- [ ] Add/remove label
- [ ] Archive task, verify hidden, toggle "show archived" to see it

### Test 4: Sprint Workflow
- [ ] Create sprint with custom columns and WIP limits
- [ ] Drag tasks from backlog into sprint
- [ ] Activate sprint — Board tab shows it
- [ ] Move tasks between columns — WIP limit warnings appear (red/amber)
- [ ] Close sprint — test "move incomplete tasks" options

### Test 5: Hierarchy
- [ ] Create initiative → epic → story → task chain
- [ ] EpicsView tree renders with expand/collapse
- [ ] Click nested task — breadcrumbs show full chain
- [ ] Progress bars aggregate correctly up hierarchy

### Test 6: Time Tracking
- [ ] Open task, log time (30 min, today)
- [ ] Log more time — total accumulates
- [ ] "Logged vs estimated" display when task has estimated hours
- [ ] Delete a time entry

### Test 7: Saved Views & Filters
- [ ] Apply filters (status + priority), save as view
- [ ] Clear filters, reload saved view — restores correctly
- [ ] Share view — appears under "Shared Views"
- [ ] Advanced filter builder — create OR group, apply, verify results

### Test 8: Permissions
- [ ] In Members tab, change role to "viewer" on a project
- [ ] Verify buttons disabled (can't create/edit tasks)
- [ ] Change role to "editor" — can create/edit again

### Test 9: Charts & Analytics
- [ ] Dashboard tab — velocity, burndown, cumulative flow charts render
- [ ] Cycle Time panel — date range presets work
- [ ] Portfolio page — rollup stat cards show aggregate data

### Test 10: Releases
- [ ] Create release (name + version)
- [ ] Add tasks to release
- [ ] Generate release notes (requires Anthropic key)
- [ ] Change release status (draft → scheduled → released)

### Test 11: Responsive & Edge Cases
- [ ] Phone-width viewport — sidebar collapses, navigation works
- [ ] Very long task title/description — layout doesn't break
- [ ] Rapid task switching — no stale data or race conditions
- [ ] Two tabs, edit same task — no data loss
- [ ] Log out → access /app — redirects to login

### Test 12: Real-Time (SSE)
- [ ] Two browser tabs on same project
- [ ] Create task in tab 1 — appears in tab 2 without refresh
- [ ] Change task status in tab 1 — tab 2 updates

---

## Competitive Gap — P0 (Foundation)

These block scaling, process enforcement, and basic team adoption.

### Task Lifecycle & Workflow
- [x] **Workflow transition model** — WorkflowTransition model with CRUD, updateTask validation, backward-compatible (no rules = all moves). *(Wave 30, tasks 003-004)*
- [x] **Dependency graph** — TaskDependency join table with cycle detection + blocking validation. *(Wave 29)*
- [x] **Dependency blocking warning surfacing** — updateTask returns `UpdateTaskResult { task, warnings }`, frontend shows warning toasts. *(Wave 30, task-003)*
- [x] **Data migration: dependsOn → TaskDependency** — SQL migration + column drop + all references removed. *(Wave 30, task-005)*

### Search & Filtering
- [x] **Server-side task filtering** — TaskFilterInput with status/priority/assignee/labels/search/sort. Dynamic Prisma WHERE. Frontend debounced re-fetch. *(Wave 30, tasks 001-002)*

### Collaboration
- [x] **@mention notification routing** — Already implemented in `createComment` resolver (lines 267-285). Extracts @email mentions via regex, batch-looks up users, passes `mentionedUserIds` to notification listener. Stale todo — was done before Wave 28.

---

## Competitive Gap — P1 (Competitive Parity)

Expected by teams switching from Jira/Asana/Wrike.

### Task Lifecycle & Workflow
- [x] **Cycle time / lead time metrics** — Computed query over existing Activity table. Lead time = created→done. Cycle time = first in_progress→done. Aggregate per sprint/time window. No schema changes. *(Wave 29)*
- [x] **Cycle time date range filter UI** — Date pickers with presets (7d/30d/90d/This Sprint), validation, clear button. *(Wave 31, task-004)*
- [ ] **SLA tracking** — `SLAPolicy { projectId, name, targetMinutes, businessHoursCalendar?, pauseOnStatuses? }` and `SLATimer { taskId, policyId, startedAt, pausedMinutes, breachedAt? }`. Evaluate on status transitions.

### Planning & Estimation
- [x] **User capacity model** — UserCapacity + UserTimeOff models, CRUD, teamCapacitySummary query, sprint planner integration. *(Wave 33, task-002)*
- [x] **User capacity frontend** — TeamCapacityPanel in OrgSettings, sprint planning integration with real capacity data. *(Wave 33, task-003)*
- [x] **Release model** — Release + ReleaseTask models, CRUD, task association, AI release notes generation, frontend list/detail/modal + Releases tab. *(Wave 31, tasks 005-006)*

### Views & Visualization
- [x] **Kanban swimlanes** — `groupBy` parameter on KanbanBoard (assignee, priority, epic). Collapsible swimlane headers, localStorage persistence. *(Wave 30, task-006)*
- [x] **WIP limits** — `wipLimits` JSON field on Sprint, KanbanBoard column header warnings (red/amber), SprintCreateModal per-column inputs, soft enforcement via UpdateTaskResult warnings. *(Wave 31, task-003)*
- [x] **Cumulative flow diagram** — `cumulativeFlow` query computing daily status snapshots from Activity table. Hand-coded SVG stacked area chart with hover tooltips. *(Wave 32, task-001)*

### Search & Filtering
- [x] **Compound filter expressions** — FilterGroup with AND/OR recursive Prisma translation, depth/count validation, exported for automation reuse. Frontend FilterBuilder UI with nesting. *(Wave 33, tasks 004-005)*
- [x] **Saved views** — Extended SavedFilter with viewType, sortBy, sortOrder, groupBy, visibleColumns, isShared. SavedViewPicker UI with shared views support. *(Wave 32, tasks 005-006)*

### Collaboration
- [x] **Task watchers** — TaskWatcher join table, auto-watch on create/assign/mention, watcher notifications, Watch/Unwatch UI toggle, DataLoader. *(Wave 31, tasks 001-002)*

### Automation
- [ ] **Multi-action automation rules** — Change `action` field from single JSON to array. Execute sequentially. Add action types: `send_webhook`, `add_label`, `add_comment`, `set_due_date`.
- [ ] **Compound automation conditions** — Reuse `FilterGroup` from search. Support operators: `>`, `<`, `contains`, `is_empty`, `changed_to`, `changed_from`.

### Reporting
- [x] **Cross-project rollup metrics** — `portfolioRollup` query with totalVelocity, avgCycleTimeHours, teamSprintProgress, aggregateStatusDistribution. Portfolio page stat cards. *(Wave 32, task-002)*
- [ ] **Scheduled report delivery** — `ReportSchedule { reportType, projectId, cronExpression, recipientUserIds }`. Reuse existing AI report generators. Deliver via email or Slack webhook.

### Hierarchy
- [x] **Multi-level hierarchy UI** — Recursive EpicsView tree with expand/collapse, TaskDetailPanel breadcrumbs, initiative taskType, recursive descendant progress counting. *(Wave 33, task-001)*

### Time Tracking
- [x] **TimeEntry model** — TimeEntry with CRUD, task/sprint time summaries, per-user breakdowns. Frontend: time log UI in task detail, sprint time summary. *(Wave 32, tasks 003-004)*

### Permissions
- [x] **Permission scheme** — Permission enum, ROLE_PERMISSIONS mapping, requirePermission helper, resolver guards on key mutations, myPermissions query, frontend PermissionContext + usePermissions hook, permission-aware UI. *(Wave 34, tasks 004-005)*

---

## Competitive Gap — P2 (Differentiators / Enterprise)

Nice-to-haves and enterprise features for later.

### Planning & Estimation
- [ ] **Monte Carlo forecasting** — Sample from historical velocity distribution, project sprint completion probability. Pure computation over existing `sprintVelocity` data.

### Views & Visualization
- [ ] **Cycle time scatter / control chart** — Query activity for done-tasks in time window, compute cycle time, plot with percentile overlay lines (50th, 85th, 95th).

### Search & Filtering
- [ ] **Query language (TQL)** — PEG parser compiling to FilterGroup structure. Syntax: `status:in_progress AND (priority:high OR label:"urgent")`. Deferred until filter infrastructure is solid.

### Collaboration
- [ ] **Approval workflows** — `Approval { taskId, requesterId, approverId, status: pending|approved|rejected }`. Optionally triggers workflow transitions.

### Automation
- [ ] **Scheduled triggers** — `scheduleExpression` (cron) field on AutomationRule. Lightweight job scheduler evaluates rules on schedule.

### Reporting
- [ ] **Workload heatmap** — Tasks grouped by assignee + week(dueDate). Calendar grid colored by load (green/yellow/red).

### Hierarchy
- [ ] **Cross-project initiatives** — `Initiative { initiativeId, orgId, name, targetDate, status }` + `initiativeId` FK on Task. Portfolio-level tracking.

### Time Tracking
- [ ] **Auto-tracking from status transitions** — Start timer on In Progress, stop on exit. Store as `TimeEntry` with `autoTracked: true`.
- [ ] **Timesheet view** — Weekly grid: rows=tasks, columns=days, cells=logged hours.

### Permissions
- [ ] **Workflow-based permissions** — `allowedRoles` on `WorkflowTransition`. Only matching roles can perform specific transitions.
- [ ] **Field-level edit restrictions** — `FieldPermission { projectId, fieldName, editableByRoles }`. Check in `updateTask` per field.
