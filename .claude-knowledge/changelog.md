# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-21 (timesheet + approvals + follow-up polish)

### Wave 48: Timesheet, Approval Workflows & Follow-up Polish (3 workers, 3 tasks)

**Worker 1 — task-001: Timesheet View:**
- `timesheetData(projectId, userId?, weekStart)` query returns weekly grid with per-task per-day time entries, row/column totals.
- `TimesheetView.tsx` — 7-day grid (task rows × Mon-Sun columns + Total), inline hour editing (click cell → input → blur upserts TimeEntry), week navigation (prev/next), user filter dropdown, today column highlight.
- Wired into ProjectDetail as a lazy-loaded "Timesheet" tab.

**Worker 2 — task-002: Approval Workflows:**
- New `Approval` model (taskId, orgId, requestedById, approverId?, fromStatus, toStatus, status pending/approved/rejected, comment?, decidedAt?). Migration: `add_approvals`.
- `updateTask` resolver checks WorkflowTransition conditions — if `requiresApproval: true`, creates Approval record instead of changing status, returns warning.
- `approveTransition` mutation: marks approved, executes the pending status change. `rejectTransition`: marks rejected, task stays.
- `pendingApprovals(projectId)` and `taskApprovals(taskId)` queries.
- TaskDetailPanel shows pending approval badge with approve/reject for authorized users. `PendingApprovalsPanel.tsx` accessible from project toolbar.

**Worker 3 — task-003: Follow-up Polish (5 items):**
- Release burndown tests: `releaseBurndown.test.ts` — 5+ edge case tests (no tasks, all done, no activities, mixed status, released release).
- Cycle time control chart mode: Table/Scatter/Control toggle — rolling 10-task average line + ±2σ standard deviation bands.
- Workload heatmap display names: resolver + TimeEntryList use `user.displayName || email.split('@')[0]`.
- Auto-tracking multi-assignee: duration split evenly across all TaskAssignee entries.
- Auto-tracking listener tests: `timeTrackingListener.test.ts` — 5+ tests (in_progress→done, todo→in_progress no-op, revert, multi-assignee split, no activity graceful).

**Process:** task-002 sent back once for rebase conflict with task-001 in ProjectDetail.tsx. All tasks passed typecheck/lint/build on first attempt. Pre-existing integration test flakiness noted (FK violations, deadlocks) — not from Wave 48.

**Open follow-ups:**
- Timesheet: delete entry on 0 hours, keyboard cell navigation, display names in user filter
- Approval workflows: SSE notification, approval history/audit log, configurable approvers per transition
- Control chart: configurable rolling window size
- Fix flaky integration tests (FK violations, deadlocks, unique constraints)

---

## 2026-03-21 (P2 visualizations + productivity + polish)

### Wave 47: P2 Charts, Auto-Tracking, Workload Heatmap & Polish (3 workers, 3 tasks)

**Worker 1 — task-001: Cycle Time Scatter + Release Burndown:**
- Cycle time scatter chart in CycleTimePanel: SVG with date×hours dots, P50/P85/P95 percentile overlay lines (green/amber/red dashed), hover tooltips with task title + duration. Table/Scatter view toggle.
- Release burndown chart: `releaseBurndown(releaseId)` query (daily total/completed/remaining task series from activities), `ReleaseBurndownChart.tsx` SVG line chart wired into release detail view.

**Worker 2 — task-002: Auto-Tracking + Workload Heatmap:**
- Auto-tracking from status transitions: `autoTracked` boolean on TimeEntry (migration). New `timeTrackingListener.ts` — when status changes from `in_progress`, calculates duration from last `in_progress` activity and creates TimeEntry with `autoTracked: true`. "Auto" badge in time log UI. Entries are editable.
- Workload heatmap: `workloadHeatmap(projectId, startDate, endDate)` query returns per-user per-week hours/task counts. `WorkloadHeatmap.tsx` — user×week grid with color-coded cells (green <30h, amber 30-40h, red >40h). Wired into Dashboard tab.

**Worker 3 — task-003: Polish Batch (6 items):**
- Cron scheduler graceful shutdown: `stop()` tracks active execution promises, awaits before resolving. SIGTERM handler in index.ts calls `scheduler.stop()`.
- Automation cron validation: `createAutomationRule` rejects scheduled triggers without valid `cronExpression` (parsed with cron-parser).
- SLA periodic breach checker: `slaBreachChecker.ts` runs every 5 minutes, flags overdue SLATimers where `now - startedAt > responseTimeHours`.
- Monte Carlo edge case tests: `monteCarloForecast.test.ts` — zero work, empty velocities, single data point, large simulation count, negative days.
- SprintForecastPanel skeleton loader: replaces bare "Loading forecast..." text.
- Sentry ErrorBoundary guard: `captureException` guarded against uninitialized Sentry.

**Process:** All 3 tasks merged cleanly with zero rejections. No issues logged.

**Open follow-ups:**
- Release burndown: tests for edge cases (no tasks, all done, no activities)
- Cycle time scatter: control chart mode (rolling average, std dev bands)
- Workload heatmap: use display name instead of email prefix
- Auto-tracking: handle multi-assignee during in_progress, add listener tests

---

## 2026-03-21 (code quality + tests + P2 features)

### Wave 46: Code Quality, Unit Tests & P2 Features (3 workers, 3 tasks)

**Worker 1 — task-001: Code Quality Fixes:**
- SLA permission fix: `createSLAPolicy`/`updateSLAPolicy`/`deleteSLAPolicy` now use `requirePermission('MANAGE_PROJECT_SETTINGS')` instead of basic `requireProjectAccess`.
- Removed 3 `context.prisma as unknown as PrismaClient` double casts in auth.ts — changed `trackRefreshToken` parameter type to `Context['prisma']`.
- AppLayout `fetchCount` lint warning fixed — 0 lint warnings remaining across entire codebase.
- Sentry web frontend integration: `@sentry/react` installed, `Sentry.init()` in production with `VITE_SENTRY_DSN`, `ErrorBoundary.componentDidCatch` calls `Sentry.captureException`.

**Worker 2 — task-002: Unit Test Suites (35 new tests):**
- `cyclicDependencyCheck.test.ts` — 8+ tests: self-loops, direct/indirect cycles, non-blocking type exclusion, `is_blocked_by` normalization, multiple proposed edges.
- `urlValidator.test.ts` — 8+ tests: valid URLs, localhost variants, private IP ranges, blocked ports, protocol restrictions. DNS resolution mocked.
- `insightGeneration.test.ts` — 5+ tests: insight generation called after `generate_code`, skipped for other types, non-blocking on failure, TaskInsight record creation.

**Worker 3 — task-003: P2 Features:**
- Monte Carlo sprint forecasting: `sprintForecast` query, `monteCarloForecast.ts` pure simulation function, `SprintForecastPanel.tsx` with probability gauge + percentile table (50th/75th/90th/95th). Only renders with >= 3 closed sprints.
- Scheduled automation triggers: `cronExpression`, `timezone`, `nextRunAt`, `lastRunAt` fields on AutomationRule. `cronScheduler.ts` checks due rules every 60s via `setInterval`. `cron-parser` package for expression parsing. AutomationTab schedule section with presets (hourly, daily, weekly) and timezone selector.

**Process:** All 3 tasks merged. Reviewer encountered squash merge issue (deleting files from previously-merged tasks when worker branch diverged) — worked around with `git cherry-pick --no-commit`.

**Open follow-ups:**
- Monte Carlo forecast edge case tests
- Sentry ErrorBoundary initialization guard
- Automation rule validation: enforce cronExpression on scheduled triggers
- Cron scheduler graceful shutdown (track active promises)
- SprintForecastPanel loading state (use skeleton loader)
- merge-worker.sh: fix squash merge to use cherry-pick when diverged

---

## 2026-03-21 (P1 features + polish + L-5)

### Wave 45: P1 Features, Polish & Session Limit (5 workers, 6 tasks)

**Worker 1 — task-001 + task-002: Multi-Action Automation Rules:**
- Backend: automation engine now processes action arrays (backward-compatible with single objects). 4 new action types: `send_webhook` (validated URL + webhookDispatcher), `add_label` (TaskLabel, skip if exists), `add_comment` (Comment record), `set_due_date` (daysFromNow calculation).
- Compound conditions: `matchesCondition()` supports `{operator: "AND"|"OR", conditions: [{field, op, value}]}` in addition to simple `{key: value}`.
- Zod validation for action types in createAutomationRule/updateAutomationRule resolvers.
- Frontend: AutomationTab multi-action builder (dynamic add/remove rows, 8 action types with appropriate inputs), compound condition builder (AND/OR toggle, field/op/value rows).

**Worker 2 — task-003: SLA Tracking (Full Vertical Slice):**
- New `SLAPolicy` model (projectId, name, responseTimeHours, resolutionTimeHours, priority filter, enabled) and `SLATimer` model (taskId, policyId, startedAt, respondedAt, resolvedAt, responseBreached, resolutionBreached).
- Migration: `add_sla_tracking`.
- CRUD resolvers with permission checks. `taskSLAStatus` query returns timers with computed time-remaining fields.
- `slaListener.ts`: creates timers on task.created, updates on status transitions (start→in_progress, respond→in_review, resolve→done), checks breach flags.
- Frontend: `SLAStatusBadge.tsx` (green/amber/red) in task detail, SLA policy management in project settings.

**Worker 3 — task-004: Backend Polish:**
- TaskInsight sourceTask/targetTask field resolvers now use `context.loaders.taskById.load()` — eliminates N+1 queries.
- `refreshRepoProfile` creates/updates `KnowledgeEntry` with source='learned' instead of only writing to legacy `project.knowledgeBase` field (backward compat preserved).
- ManualTaskSpec acceptanceCriteria: removed unsafe double cast, uses direct property access.

**Worker 4 — task-005: Frontend Polish:**
- HierarchicalPlanEditor: `setExpandedIds` lint warning fixed (lazy initializer instead of effect). Lint warnings reduced from 3 to 1.
- Extracted ~3 inline dynamic mutations from useTaskOperations.ts to `buildUpdateTaskMutation()` in queries.ts.
- Insight duplicate fetch eliminated: TaskDetailPanel passes loaded insights to InsightPanel as initial data.
- OnboardingWizard: Enter/Ctrl+Enter advances steps, Escape closes, auto-focus on primary inputs.

**Worker 5 — task-006: L-5 Concurrent Session Limit:**
- New `RefreshToken` model (userId, tokenHash, expiresAt, userAgent) in auth.prisma. Migration: `add_refresh_tokens`.
- Login/acceptInvite/verifyEmail create RefreshToken records with hashed tokens.
- Max 5 concurrent sessions per user (configurable via `MAX_SESSIONS_PER_USER`). Oldest sessions pruned on new login.
- Refresh endpoint (`/api/auth/refresh`) validates token exists in DB, implements token rotation (delete old, create new).
- Logout deletes specific RefreshToken record.
- Expired token cleanup on server startup.

**Process:** All 6 tasks merged with zero rejections. 44 pre-existing test failures on main (not from this wave) prevented test validation in merge pipeline.

**Open follow-ups:**
- Fix 44 pre-existing integration test failures (FK/DB state issues)
- Remove `context.prisma as unknown as PrismaClient` casts in auth.ts (3 instances)
- SLA: createSLAPolicy should use requirePermission('MANAGE_PROJECT_SETTINGS')
- SLA: periodic breach-check job (currently only on status transitions)
- SLA: paused time handling (reopened tasks, business hours)
- AppLayout fetchCount lint warning (last remaining)

---

## 2026-03-21 (security cleanup + tests + polish)

### Wave 44: Security Cleanup, Integration Tests & Auth Follow-ups (3 workers, 5 tasks)

**Worker 1 — task-001: Remaining Security Fixes (M-4, L-6, L-11):**
- M-4: File upload magic byte validation via `file-type@16.5.4`. Validates uploaded file content against declared MIME type; rejects mismatches with 400. Text files (no magic bytes) skip validation.
- L-6: Unicode homograph detection — `hasHomoglyphRisk()` rejects filenames mixing Latin with Cyrillic/Greek scripts.
- L-11: Null byte stripping middleware added before all REST routes in app.ts via `stripNullBytes()` on req.body and req.query.

**Worker 1 — task-002: Data Migration Scripts:**
- `apps/api/scripts/migrate-encrypt-secrets.ts` — encrypts plaintext webhook secrets and Slack URLs using `encryptApiKey()`, skips already-encrypted values.
- `apps/api/scripts/migrate-hash-invite-tokens.ts` — hashes plaintext invite tokens via `hashToken()`, requires `--confirm` flag (warns about invalidating active invites).
- Both scripts load `.env` for DATABASE_URL and ENCRYPTION_MASTER_KEY.

**Worker 2 — task-003: Security Integration Tests (~19 tests):**
- New `security.integration.test.ts` covering 8 test groups:
  - Cookie auth flow (login sets cookies, logout clears, refresh works, revoked token rejected)
  - CSRF protection (403 without X-Requested-With, 200 with it)
  - AI rate limiter (throws when over limit, passes when under)
  - Audit logging (Activity records for setOrgApiKey, inviteOrgMember)
  - Email anti-enumeration (signup returns same response for existing email)
  - Export email redaction (?redactEmails=true masks emails)
  - Bulk update cap (101 items throws ValidationError)
  - Input validation (sprint name >200, label name >100 rejected)

**Worker 3 — task-004: Auth Follow-ups:**
- `verifyEmail` mutation now sets HttpOnly cookies (tt-access, tt-refresh) on success — auto-login after email verification.
- New `VerifyEmailResult` type in typedefs/auth.ts returning `{ success, token }`.
- Frontend VerifyEmail page handles new response — redirects to `/app` on success.
- `SessionExpiredModal` — replaces hard redirect to /login on refresh failure. Dispatches `session-expired` CustomEvent from client.ts, AuthProvider listens and shows modal overlay.

**Worker 3 — task-005: Frontend Polish:**
- Permission-based field disabling in TaskDetailPanel — fields disabled when user lacks EDIT_TASKS permission via existing PermissionContext.
- SavedViewPicker lint warnings fixed (lines 43, 58) — reduced total warnings from 5 to 3.
- BacklogView keyboard navigation — Enter/Space to select task, Arrow Up/Down to navigate, ARIA roles (listbox/option).

**Process:** All 5 tasks merged cleanly. No issues logged.

**Open follow-ups:**
- Run data migration scripts in production (migrate-encrypt-secrets.ts, migrate-hash-invite-tokens.ts)
- L-5 (concurrent session limit) still open — needs RefreshToken model design
- L-12 (test DB credentials in CI) — CI config, not code
- Integration tests for verifyEmail cookie-setting (new behavior)

---

## Older Entries (one-line summaries)

- **2026-03-21** — Wave 43: Security Phase 3+4 — 9 Medium + 6 Low fixes (introspection, DataLoader orgId, input validation, AI rate limiter, audit logging, email anti-enum, GitHub path encoding, export redaction, webhook delivery ID, bulk cap).

- **2026-03-21** — Wave 42: Security Phase 2 — JWT→HttpOnly cookies, CSRF protection, webhook/Slack encryption, invite token hashing, pagination caps, re-auth for sensitive ops. All 8 High items resolved.
- **2026-03-20** — Wave 41: Execution dashboard (plan list, stat cards, SSE real-time), insight review UI + toast notifications, manual task specs + auto-start project.
- **2026-03-20** — Wave 40: Status-driven events (action_plan_failed, task.blocked/unblocked), TaskInsight model + AI generation hook, CI monitor + auto-fix executors.

- **2026-03-20** — Wave 39: Project orchestrator (parallel execution, advisory locks, concurrency limit), AI-enriched PR descriptions, plan dependency editor wiring, HierarchicalPlanDialog feedback.
- **2026-03-20** — Wave 38: Hierarchical plan generation (3-level epics→tasks→subtasks), batch cycle detection, plan editor UI (tree view, drag-to-reorder, dependency picker).

- **2026-03-20** — Wave 37: KB panel (CRUD + file upload), onboarding interview wizard, KB context injection into action pipeline.
- **2026-03-20** — Wave 36: KnowledgeEntry model + CRUD, AI-based KB retrieval, autoComplete flag + informs link type.
- **2026-03-20** — Wave 35: Critical security fixes (C-1 through C-5, H-5/H-7/H-8/H-11) — token revocation, multi-tenant isolation, SSRF protection.
- **2026-03-20** — Wave 34: Query centralization (~90 inline→queries.ts), ARIA audit + TaskDetail tabs, permission scheme (22 permissions).
- **2026-03-20** — Waves 31-33: Task watchers, WIP limits, release model, cumulative flow chart, time tracking, saved views, multi-level hierarchy, user capacity, compound filters.
- **2026-03-19** — Waves 28-30: codebase cleanup (dead code, decomposition), dependency graph, cycle time metrics, server-side filtering, workflow transitions, kanban swimlanes.
- **2026-03-17** — Waves 22-27: GitHub integration (repo linking, PR creation, issue decomposition), Slack integration, webhook system, notification preferences, dark mode, PWA, S3 file attachments, responsive layout, SSE real-time.
- **2026-03-16** — Waves 14-21: Sentry integration, lazy loading, code splitting, unit/integration tests, CI pipeline, file attachments, recurring tasks, accessibility audit, shared-types package, action plan pipeline improvements.
- **2026-03-14** — Waves 8-13: AI code generation, GitHub PR creation, action plan pipeline, AI caching, prompt logging, task templates, multiple assignees, custom fields, saved filters, Prometheus metrics, structured logging.
- **2026-03-13** — Waves 4-7: Sprint model, kanban board, backlog view, AI task planning, notification system, SSE real-time events, comment @mentions, project export (CSV/JSON).
- **2026-03-12** — Waves 1-3: Initial build. Express + graphql-yoga + Prisma setup, HMAC JWT auth, React frontend, task CRUD, project CRUD, org management, security hardening (helmet, CORS, rate limiting), generation UX (skeletons, progress, abort).
