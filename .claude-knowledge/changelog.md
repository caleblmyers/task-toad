# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-22 (final cleanup)

### Wave 52: Final Cleanup — SLA Business Hours, Reliability, Test Stability (3 workers, 3 tasks)

**Worker 1 — task-001: SLA Business Hours + useAsyncData + TQL Polish:**
- SLA business hours: `businessHoursStart`, `businessHoursEnd`, `excludeWeekends` fields on SLAPolicy (migration). `calculateBusinessHours()` utility excludes weekends and non-business hours from SLA timer evaluation. Breach checker and listener use business hours calculation.
- useAsyncData: 5 more components migrated (Portfolio, PendingApprovals, SprintForecast, Timesheet, WorkloadHeatmap).
- TQL autocomplete keyboard nav: Arrow Up/Down to highlight, Enter to select, Escape to close.
- TQL saved queries: delete (X button + confirm) and rename (inline edit) support.

**Worker 2 — task-002: Pipeline Reliability:**
- monitor_ci restart resilience: Extracted `evaluateCheckRuns()` and created `monitorCIPoll.ts` job that uses the job queue for follow-up polls instead of in-process sleep. Startup scan marks stuck monitor_ci actions as failed after 35 min.
- cancelActionPlan interrupt: `Map<string, AbortController>` pattern in actionExecutor. Cancel aborts in-flight fetch calls and checks `signal.aborted` before/after AI API calls. AbortController cleaned up on action completion.

**Worker 3 — task-003: Test Stability + Swarm Docs:**
- Flaky test fix: expanded `cleanDatabase()` table list with all Wave 45-52 tables (refresh_tokens, sla_policies, sla_timers, approvals, initiatives, initiative_projects, field_permissions). Added retry logic for TRUNCATE with 50ms delay. Pre-cleanup drain delay for fire-and-forget operations.
- task-swarm SKILL.md: added Prisma model conflict guidance to task dependency section.

**Process:** DB was down during merge validation — reviewer had to manually merge task-002. monitorCIPoll.ts duplicates action-completion orchestration from actionExecutor.ts (tech debt noted).

---

## 2026-03-22 (big cleanup wave)

### Wave 51: Feature Polish, Reliability & Follow-up Cleanup (3 workers, 3 tasks)

**Worker 1 — task-001: Feature Polish (5 items):**
- KB entry search/filter in KnowledgeBasePanel — client-side search by title/content with highlighting.
- ExecutionDashboard dependency badges: shows "Blocked by: Plan #N" for plans with task-level blocking relationships.
- ExecutionDashboard stat cards fix: separate unfiltered query for counts, filtered query for list.
- S3 multipart upload: files >10MB use `@aws-sdk/lib-storage` Upload, small files still use PutObjectCommand. Multer limit raised to 100MB.
- useAsyncData adoption: migrated 3-5 components from inline fetch-in-useEffect to useAsyncData hook.

**Worker 2 — task-002: Code Quality + Reliability (6 items):**
- Hierarchical plan integration tests: `hierarchicalPlan.integration.test.ts` — preview, commit, autoComplete toggles, validation errors.
- SLA paused time: `pausedAt` and `totalPausedMs` fields on SLATimer (migration). Listener pauses timer on in_progress→todo, resumes on re-entry. Breach check subtracts paused time.
- AI rate limiter in-memory cache: sliding window `Map<orgId, {count, windowStart}>`, refreshes from DB once per hour per org.
- SDK app-level retry: `callWithRetry()` wraps AI calls with 2 retries + exponential backoff (1s/2s/4s, max 10s) for transient errors (5xx, connection). Does NOT retry auth/rate-limit/bad-request.
- Email redaction default: non-admin exports redact emails by default. Admins can opt in with `?includeEmails=true`.
- Planning prompt validation: validates source action IDs exist before referencing in AI planning prompt.

**Worker 3 — task-003: Follow-up Polish (8 items):**
- TQL autocomplete: field name dropdown appears when typing bare words in TQL mode.
- TQL saved queries: stored as SavedFilter with `viewType: 'tql'`.
- TQL regex dedup: `isTQLQuery()` extracted to shared `tqlHelpers.ts`.
- Approval comment display: requester's comment shown in approval history.
- Approval email notification: sends email to designated approvers if SMTP configured, logs structured message otherwise.
- Orchestrator Prometheus metrics: 3 counters (tasks_enqueued, failures, concurrency_limit_hits).
- Shared-types: `Report` interface exported from `@tasktoad/shared-types`.
- PlanDependencyEditor subtask support: subtasks included in dependency picker with indented hierarchy.

**Process:** task-002 sent back once for missing `callWithRetry` implementation. task-001 needed manual `pnpm install` for `@aws-sdk/lib-storage` before merge validation. Test fix: security test for email redaction updated for new default-on behavior.

**Open follow-ups:**
- merge-worker.sh should auto-detect lockfile changes and run `pnpm install --frozen-lockfile`
- For tasks with 6+ acceptance criteria, add self-verify checklist reminder

---

## 2026-03-21 (TQL + follow-up fixes)

### Wave 50: Task Query Language & Follow-up Fixes (3 workers, 3 tasks)

**Worker 1 — task-001: Task Query Language (TQL):**
- Recursive descent parser in `tqlParser.ts`: `parseTQL(query) → FilterGroupInput`. Supports field:value, negation (-field:value), multi-value (status:done,in_progress), comparisons (storyPoints>5), text search, OR grouping with parens, quoted values.
- `TQLParseError` with position info for invalid fields/syntax.
- `tql` parameter added to `tasks` query — parsed and merged with existing filterGroup via AND.
- Frontend: search bar detects TQL syntax (contains `:`) and sends as `tql` param. Help tooltip with syntax reference. Parse errors shown inline.
- 9+ unit tests in `tqlParser.test.ts`.

**Worker 2 — task-002: Follow-up Fixes (6 items):**
- Field permission mapping: added `priority` and `estimatedHours` to `fieldArgMapping` (was only 3/5 fields).
- Field permission DataLoader: `fieldPermissionsByProject` batches lookups, replaces per-request query in updateTask.
- Initiative edit modal: `EditInitiativeModal` with name/description/status/targetDate editing.
- Initiative DataLoader: `initiativeProjectsByInitiative` batches join table lookups.
- Initiative dark mode: Tailwind dark mode variants on Create/Edit modals.
- Approval history: TaskDetailPanel shows past approvals as a log (pending at top with actions, decided below).

**Worker 3 — task-003: Follow-up Fixes (5 items):**
- Timesheet display names: user filter shows `displayName || email prefix`.
- Timesheet arrow key bug: arrow keys now navigate without saving. Only blur/Enter/Tab save.
- Configurable approvers: `approverUserIds` in WorkflowTransition condition JSON. Approval resolvers check designated approvers, fallback to MANAGE_PROJECT_SETTINGS. User picker in workflow settings.
- Approval SSE approver info: `approval.decided` event includes `approverEmail` and `approverDisplayName`.
- Keyboard nav verified: Enter still saves + moves down after arrow key refactor.

**Process:** All 3 tasks merged cleanly. Flaky integration tests required one re-run during review.

**Open follow-ups:**
- TQL: autocomplete/suggestions dropdown, saved queries, shared regex util
- Approval: show requester's comment, email notifications to designated approvers

---

## 2026-03-21 (initiatives + access control + polish)

### Wave 49: Cross-Project Initiatives, Workflow Permissions & Polish (3 workers, 3 tasks)

**Worker 1 — task-001: Cross-Project Initiatives:**
- New `Initiative` + `InitiativeProject` models (many-to-many with Project). Migration: `add_initiatives`.
- CRUD resolvers: `createInitiative`, `updateInitiative`, `deleteInitiative`, `addProjectToInitiative`, `removeProjectFromInitiative`.
- `initiativeSummary` query aggregates stats (totalTasks, completedTasks, completionPercent, healthScore, projectCount) across initiative's projects.
- Portfolio page: initiatives section with rollup cards, click-to-filter project grid, create initiative modal.

**Worker 2 — task-002: Workflow Permissions + Field Restrictions:**
- WorkflowTransition `allowedRoles` now enforced in `updateTask` — forbidden roles get `ForbiddenError`. Workflow settings UI has multi-select for `allowedRoles` per transition.
- New `FieldPermission` model (projectId, fieldName, allowedRoles JSON). Migration: `add_field_permissions`.
- `updateTask` checks field permissions before applying changes — restricted fields return warnings. Maps storyPoints, dueDate, assigneeId (priority and estimatedHours mapping incomplete — follow-up).
- `setFieldPermission`/`deleteFieldPermission` mutations with `MANAGE_PROJECT_SETTINGS`. Field permissions table in project settings.

**Worker 3 — task-003: Polish Batch (5 items):**
- Timesheet: setting cell to 0 deletes the entry. Tab/Shift+Tab/Arrow/Enter/Escape keyboard navigation between cells.
- Approval SSE: `approval.requested` and `approval.decided` events broadcast via sseManager. Frontend toast on approval request.
- Control chart: configurable rolling window size (5/10/15/20 dropdown).
- merge-worker.sh: cherry-pick path when worker branch has diverged from main. Lint check uses exit code not output.

**Process:** task-002 sent back once for rebase conflict with task-001 in shared import files (both added Prisma models). Cherry-pick merge fix from task-003 was immediately useful.

**Open follow-ups:**
- Field permissions: priority and estimatedHours not in fieldArgMapping (3/5 fields enforced)
- Field permissions: DataLoader for lookups in updateTask
- Initiative: update/edit modal, DataLoader for summary queries, dark mode modal
- Approval SSE: include approver info in decided event

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

## Older Entries (one-line summaries)

- **2026-03-21** — Wave 47: P2 features (cycle time scatter chart, release burndown, auto-tracking from status transitions, workload heatmap), polish (cron graceful shutdown, automation cron validation, SLA breach checker, Monte Carlo tests, forecast skeleton, Sentry guard).
- **2026-03-21** — Wave 46: Code quality (SLA perms, prisma casts, Sentry web, 0 lint warnings), unit tests (cyclicDependencyCheck, urlValidator, insightGeneration), P2 (Monte Carlo forecasting, scheduled automation triggers).
- **2026-03-21** — Wave 45: P1 features (multi-action automation, SLA tracking, compound conditions), L-5 concurrent session limit (RefreshToken model), backend polish (DataLoader N+1, KB refresh, cast fix), frontend polish (lint fixes, mutation extraction, insight dedup, onboarding keyboard nav).

- **2026-03-21** — Wave 44: Security cleanup (M-4 magic bytes, L-6 homograph, L-11 null byte REST), data migration scripts, 19 security integration tests, auth follow-ups (verifyEmail cookies, SessionExpiredModal), frontend polish (permission disabling, BacklogView keyboard nav, lint fixes).
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
