# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-26 (Wave 64 — Phase 1: branch-based pipeline)

### Wave 64: Phase 1 Pipeline Rewrite — Branch-Based Code Generation (3 workers, 5 tasks)

**Worker 1 — task-001: Branch management foundation:**
- Added `branchName` and `headOid` fields to `TaskActionPlan` model with migration.
- Added `repo` (GitHubRepoLink | null) and `plan` ({ id, branchName, headOid }) to `ActionContext` interface.
- `actionExecutor.ts`: loads project GitHub repo, creates feature branch on first action of a plan, passes branch context to all executors, updates `headOid` after actions that commit.

**Worker 1 — task-002: generateCode commits to branch:**
- After AI generates code, commits files to the feature branch via `commitFiles()`.
- Returns `headOid` in result for plan state tracking.
- `fetchProjectFileTree()` now accepts optional `branch` parameter — subsequent `generate_code` steps in the same plan see previously committed files.
- Cache key includes branch name to prevent stale results.
- Added Zod config validation (GenerateCodeConfigSchema).

**Worker 2 — task-003: Planner + skeptical reviewer:**
- Planning prompt now requires `create_pr` + `review_pr` for GitHub-connected repos (explicit rule + updated action type descriptions reflecting branch-based execution).
- `commitActionPlan` resolver validates that GitHub-connected plans include `create_pr` when they have `generate_code`.
- `review_pr` executor uses a skeptical reviewer system prompt — positioned as independent reviewer focused on security, error handling, standards, and architectural concerns.
- Added `monitor_ci` and `fix_ci` to `ActionPlanItemSchema` enum.
- Added Zod config validation (ReviewPRConfigSchema).

**Worker 3 — task-004: writeDocs commits to branch:**
- After AI generates documentation, commits files to feature branch.
- Returns `headOid` for plan state tracking.
- Added Zod config validation (WriteDocsConfigSchema).

**Worker 3 — task-005: createPR uses existing branch:**
- Completely rewritten — no longer calls `createPullRequestFromTask()` (which created branch + committed files + opened PR).
- Opens PR directly from existing feature branch using `createPullRequest()`.
- AI-enriched PR description with fallback template.
- Creates `GitHubPullRequestLink` record in database.
- `sourceActionId` config is now optional (branch comes from plan context).
- Added Zod config validation (CreatePRConfigSchema).

**Process:** All 5 tasks merged on first review — zero rejections. Clean wave.

### Open follow-ups
- Catch commitFiles failures in generateCode/writeDocs (prevent headOid mismatch)
- Add concurrency guard for branch creation (optimistic locking)
- Define review-blocking behavior (unapproved reviews → fail or notify?)
- Integration tests for branch flow (~5 tests, mock GitHub API)
- OAuth token routing for personal repos
- Branch cleanup strategy for failed/cancelled plans
- Extract insight generation + in_review transition to event listeners (R10)
- Audit executor config Zod: manual_step and monitor_ci schemas missing

---

## 2026-03-25 (Wave 63 — quick hits)

### Wave 63: Quick Hits Before Phase 1 (3 workers, 3 tasks)

**Worker 1 — task-001: Closed-source cleanup:**
- Replaced LICENSE (AGPL-3.0 → proprietary copyright)
- Deleted CONTRIBUTING.md
- Removed `TASKTOAD_LICENSE` env var and `SELF_HOST_OVERRIDE` from license.ts
- Removed Docker deploy profile from docker-compose.yml
- Cleaned references from CLAUDE.md and app-overview.md

**Worker 2 — task-002: Modal dismissal fix:**
- Added `closeOnOverlayClick` prop to Modal component (default true)
- ProjectSetupWizard prevents overlay dismiss during active operations

**Worker 3 — task-003: Session security fix:**
- Added user-keyed remount (`key={userId}`) to App routes — prevents stale data across logout/login cycles

**Process:** task-001 had one rejection (typo: double closing paren in CLAUDE.md). Fixed and merged. Tasks 2+3 merged on first review.

### Open follow-ups
- license.ts still logs "open source mode" at startup — update log message
- Add test coverage for Modal closeOnOverlayClick
- Add integration test for logout→login-as-different-user flow

---

## 2026-03-25 (Wave 62 — deferred refactors)

### Wave 62: Codebase Refactors from Audit (3 workers, 6 tasks)

**Worker 1 — task-001: useEditableField hook (R2):**
- Extracted `hooks/useEditableField.ts` from TaskDetailPanel's 3 repeated editing state pairs

**Worker 1 — task-002: Tab extraction (R8):**
- Extracted 5 inline tabs from TaskDetailPanel into standalone components: DetailsTab, ActivityTab, RelationsTab, ActionsTab, InsightsTab
- TaskDetailPanel reduced from ~695 lines to orchestration + tab rendering

**Worker 1 — task-003: Picker consolidation (R9):**
- Created `shared/MultiPicker.tsx` — generic multi-select component
- TaskFieldsPanel uses it for assignees, watchers, and labels (with custom rendering + label creation)

**Worker 2 — task-004: Metrics extraction (R6):**
- Created `utils/metricsCalc.ts` with calculateVelocity, calculateCycleTime, percentile, calculateHealthScore
- sprint.ts and project.ts resolvers use shared utilities (eliminated duplicate calculations)

**Worker 2 — task-005: queries.ts decomposition (R11):**
- Split 1,011-line queries.ts into domain files: auth, project, task, sprint, ai, github, misc + barrel index
- Consolidated 8 UPDATE_TASK_* mutations via factory function

**Worker 3 — task-006: Chart utilities (R12):**
- Created `hooks/useResizableContainer.ts` and `utils/chartFormatting.ts`
- 4 chart components updated to use shared utilities (eliminated 6 ResizeObserver duplications + 3 fmtDate duplications)

**Process:** All 6 merged on first review, zero rejections. Pre-existing integration test failures (19 tests) remain — noted in issues.md.

---

## 2026-03-25 (Wave 61 — pre-pipeline refactors)

### Wave 61: Pre-Pipeline Refactors (2 workers, 4 tasks)

**Worker 1 — task-001: Token manager utility (R1):**
- Extracted `utils/tokenManager.ts` with `generateTokenPair`, `setAuthCookies`, `hashRefreshToken`
- Consolidated 4 identical JWT+cookie blocks from login, verifyEmail, acceptInvite, and refresh handler

**Worker 1 — task-002: Unused exports cleanup (R14):**
- Removed `has()` from action registry (exported, never imported)
- Removed `onAny()` from EventBus port interface and adapter (test-only, not production)

**Worker 2 — task-003: Event emission helpers (R4):**
- Created `eventbus/emitters.ts` with `emitTaskEvent`, `emitSprintEvent`, `emitProjectEvent`, `emitCommentEvent`
- Updated task/mutations.ts, sprint.ts, project.ts to use helpers (16 emit calls consolidated)

**Worker 2 — task-004: Custom project option:**
- Added "Describe your own" card to NewProject page with title/description inputs
- Visually distinct (dashed border), auto-selects when typing, deselects AI options

**Process:** All 4 merged on first review, zero rejections. Reviewer noted pre-existing integration test failures (23 tests, FK constraint violations) — added to todos.

### Open follow-ups
- Integration test DB isolation failures (10 files, 23 tests) — pre-existing, added to todos

---

## 2026-03-24 (Wave 60 — scaffolding + licensing follow-ups)

### Wave 60: Wave 58/59 Follow-ups (3 workers, 4 tasks)

**Worker 1 — task-001: Scaffolding fixes (default branch + template registry + KB auto-pop):**
- Fixed `commitFilesToEmptyRepo` to use `repo.defaultBranch` instead of hardcoded `'main'`.
- Added `scaffoldTemplates` GraphQL query — moved hardcoded template list from frontend to API.
- Updated `ProjectSetupWizard` to fetch templates from API with loading state.
- Added KB auto-population after scaffold — creates entries for key scaffolded files (capped at 10).

**Worker 1 — task-002: ProjectSetupWizard unit tests:**
- Added 13 test cases covering all 4 wizard steps (github, template, scaffolding, done).
- Tests mock GraphQL calls, verify mutation arguments, cover error/loading states.
- Note: React act() warnings present (console noise, tests pass).

**Worker 2 — task-003: Licensing backend:**
- Added `orgPlan` field to `me` query response (defaults to `'free'`).
- Added `updateOrgPlan` admin-only mutation with `'free'`/`'paid'` validation.
- Created `orgPlanCache.ts` — in-memory cache with 5-min TTL for SLA listener lookups.
- Updated shared-types `Org` interface with `plan` and `licenseFeatures` fields.

**Worker 3 — task-004: Licensing frontend:**
- Updated `useLicenseFeatures` hook to read `orgPlan` from auth context instead of separate query.
- Updated `ME_QUERY` to include `orgPlan` field.
- Added "Plans" tab to OrgSettings with feature comparison table and placeholder upgrade CTA.

**Process:** All 4 tasks merged on first review, zero rejections. Smooth wave.

### Open follow-ups
- React act() warnings in ProjectSetupWizard tests
- `API: add plan field to org seed data / onboarding flow` still pending

---

## 2026-03-23 (Wave 56 — bug fixes from manual testing Round 2)

### Wave 56: Bug Fixes from Production Testing (3 workers, 6 tasks)

**Worker 1 — task-001: Priority Field Persistence:**
- Added `priority` to three-point update pipeline: backend resolver (`task/mutations.ts` Prisma update data), frontend mutation builder (`buildUpdateTaskFieldsMutation` in `queries.ts`), and frontend hook (`useTaskOperations.ts` updates type). Priority changes now persist through refresh.

**Worker 1 — task-002: Workflow Restriction Model:**
- Changed workflow from allowlist to restriction/overlay model in `task/mutations.ts`. Previously: defining ANY transition blocked all unlisted ones. Now: all transitions allowed by default; workflow rules only ADD role restrictions to specific transitions.
- Updated `WorkflowTab.tsx` UI labels to reflect restriction model ("Add Restriction" instead of "Add Transition").

**Worker 2 — task-003: Saved View Filter Capture:**
- Fixed `SavedViewPicker.tsx` — was hardcoding `filters: '{}'` instead of capturing actual filter state. Now captures statusFilter, priorityFilter, assigneeFilter, labelFilter, customFieldFilters, filterGroup as JSON.
- Restore path in `useTaskFiltering.ts` already worked — just needed real data.

**Worker 2 — task-004: Saved View Share Toggle Editing:**
- Added share/unshare button on hover for existing saved views. Wired through `updateFilter` mutation (backend already supported `isShared`).
- `UPDATE_FILTER_MUTATION` in `queries.ts` now includes `isShared` field.

**Worker 3 — task-005: Release Burndown + Full-Page Layout:**
- Release burndown resolver: handles null `releaseDate` (falls back to current date), added 365-day safety cap on date range, shows actual error text instead of generic "Unable to load burndown".
- Release detail: removed `max-w-lg` constraint, now full-width. Added back button breadcrumb for navigation.

**Worker 3 — task-006: Silent Auth Failures:**
- Root cause: GraphQL returns HTTP 200 with `extensions.code: 'UNAUTHENTICATED'` — the `gql()` client only checked HTTP 401. Fixed: after parsing JSON response, checks for UNAUTHENTICATED error code, attempts token refresh, triggers `session-expired` custom event and modal if refresh fails.

**Process:** All 6 tasks merged on first review — zero rejections. Task descriptions with exact line numbers and code snippets led to precise, minimal changes.

### Post-Wave 56 Hotfixes (2026-03-23)

Three follow-up fixes after re-testing Wave 56 on production:

1. **Priority prop type** — `TaskDetailPanel.tsx` prop type for `onUpdateTask` was missing `priority`, causing the value to be dropped before reaching the hook. Added `priority?: string`.
2. **Priority GraphQL typedef** — `updateTask` mutation in `typedefs/task.ts` was missing `priority: String` parameter. Schema silently ignored the field. Added it.
3. **Org auto-access + saved view type** — Default permissions for org members upgraded from viewer-lite to editor-level (`permissions.ts`). FilterBar saved filter pills now pass `viewConfig` so loading a saved view respects the view type it was saved from.

---

## 2026-03-22 (should-fix UX + re-tests)

### Wave 55: Should-fix UX — modal centering, time entry clarity, TQL autocomplete, automation editing, SSE real-time, saved views, epics.

---

## 2026-03-22 (must-fix UX from manual testing)

### Wave 54: Must-fix UX — priority dropdown, dependency direction UX, epics GraphQL fix.

---

## 2026-03-22 (bug fixes + V1 cuts from manual testing)

### Wave 53: Auth/PWA fix, V1 feature cuts (5 features hidden), 5 bug fixes (archived tasks, @mentions, saved views, automation).

---

## 2026-03-22 (final cleanup)

### Wave 52: Final Cleanup — SLA business hours, pipeline reliability, test stability, swarm docs.

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

## Older Entries (one-line summaries)

- **2026-03-24** — Wave 59: Per-org licensing — plan column on Org, license.ts rewrite, 33 resolver call sites, infrastructure per-event checks.
- **2026-03-24** — Wave 58: Project scaffolding — scaffold mutation, ProjectSetupWizard (4-step), empty repo commit, framework templates, planner prompt fix.
- **2026-03-23** — Wave 57: Premium feature gating — license.ts utility, resolver/infrastructure/frontend gating for 8 premium features, useLicenseFeatures hook.
- **2026-03-21** — Wave 50: TQL parser + frontend integration, follow-up fixes (field permissions, initiative edit/DataLoader/dark mode, approval history, timesheet UX, configurable approvers, SSE approver info).
- **2026-03-21** — Wave 49: Cross-project initiatives, workflow permissions (allowedRoles enforcement), field-level edit restrictions, polish (timesheet delete/keyboard, approval SSE, control chart window, merge script cherry-pick fix).
- **2026-03-21** — Wave 48: P2 features (timesheet view, approval workflows), follow-up polish (burndown tests, control chart mode, heatmap display names, auto-tracking multi-assignee + tests).
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
