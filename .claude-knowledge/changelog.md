# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-24 (Wave 59 — per-org licensing)

### Wave 59: Per-Org Licensing (2 workers, 2 tasks)

**Worker 1 — task-001: license.ts rewrite + resolver call sites:**
- Added `plan` column to Org model (default "free") with migration.
- Rewrote `license.ts`: `isPremiumEnabled(orgPlan?)`, `requireLicense(feature, orgPlan?)`, `getEnabledFeatures(orgPlan?)`. `TASKTOAD_LICENSE` env var is now a self-host override.
- Updated all 33 `requireLicense` calls across 6 resolver files to pass `context.org?.plan`.
- Added `getOrgPlan()` helper for extracting plan from context.

**Worker 2 — task-002: infrastructure + permissions + org type:**
- Infrastructure jobs/listeners (slack, SLA, cron) now load org plan from DB per-event instead of module-level boolean check.
- `permissions.ts`: `isPremiumEnabled` calls now pass `context.org?.plan`.
- `task/mutations.ts`: workflow role restriction check passes org plan.
- Added `plan: String!` to Org GraphQL type.
- Updated `licenseFeatures` field resolver to pass `org.plan`.
- Verified `context.ts` includes `plan` in org select.

**Process:** task-001 had one rejection (typecheck failure — `isPremiumEnabled` still used as boolean in task/mutations.ts). task-002 had merge conflicts with task-001's license.ts rewrite — reviewer resolved by keeping main's version.

---

## 2026-03-24 (Wave 58 — project scaffolding)

### Wave 58: Project Scaffolding for Fresh Codebases (3 workers, 3 tasks)

**Worker 1 — task-001: Backend scaffold mutation + prompt fix:**
- New `scaffoldProject` GraphQL mutation: generates framework scaffold via AI, commits to GitHub repo (handles empty repos with no prior commits via REST Git Data API).
- New `buildScaffoldPrompt()` in `apps/api/src/ai/promptBuilders/scaffold.ts` — instructs AI to generate complete project scaffold for a given framework template.
- New `commitFilesToEmptyRepo()` in `githubCommitService.ts` — creates initial commit on empty repos using blob → tree → commit → ref flow.
- Added `scaffoldProject` AI feature to `aiTypes.ts` and `aiConfig.ts`.
- Fixed planner prompt: added Rule 3 prohibiting `manual_step` for project initialization tools (create-next-app, create-vite, etc.) — instructs AI to use `generate_code` instead.

**Worker 2 — task-002: Frontend ProjectSetupWizard:**
- New `ProjectSetupWizard.tsx` component — multi-step wizard shown after project creation.
- Step 1: GitHub connection (connect existing / create new / skip).
- Step 2: Framework template selection (Next.js, Vite+React, Express+TS, Python+FastAPI).
- Step 3: Scaffolding progress (calls mutation, shows file count + summary).
- Added `SCAFFOLD_PROJECT_MUTATION` to queries.ts.

**Worker 3 — task-003: Integration wiring:**
- Modified `NewProject.tsx` to pass `showSetup: true` in navigation state after project creation.
- Modified `ProjectDetail.tsx` to show `ProjectSetupWizard` before the onboarding wizard when `showSetup` is set.

**Open follow-ups:**
- `commitFilesToEmptyRepo` hardcodes `refs/heads/main` — should respect `repo.defaultBranch`
- Add unit tests for ProjectSetupWizard
- Template list is hardcoded client-side — consider server-side template registry
- Knowledge base auto-population after scaffold (trigger KB ingestion from committed files)

---

## 2026-03-23 (Wave 57 — open core license flag system)

### Wave 57: Premium Feature Gating (3 workers, 3 tasks)

**Worker 1 — task-001: License Utility + Resolver Gating:**
- Created `apps/api/src/utils/license.ts` with `isPremiumEnabled`, `requireLicense()`, `getEnabledFeatures()`, `LicenseFeature` type.
- Added `LicenseError` class to `errors.ts` with `LICENSE_REQUIRED` GraphQL error code.
- Added `licenseFeatures: [String!]!` to Org GraphQL type with field resolver.
- Gated all resolvers for: Slack, Initiatives, SLA, Approvals, Field Permissions.

**Worker 2 — task-002: Infrastructure Gating + Permissions Bypass:**
- Gated listeners (Slack, SLA) and jobs (SLA breach checker, cron scheduler) — early return when unlicensed.
- Bypassed project role permission checks in `requirePermission()` and `getPermissionsForProject()` when unlicensed — all org members get default editor permissions.
- Gated `addProjectMember`/`removeProjectMember`/`updateProjectMemberRole` behind `requireLicense('project_roles')`.
- Gated cron automation fields — `requireLicense('cron_automations')` when `cronExpression` present.
- Wrapped workflow role restriction check in `if (isPremiumEnabled)` in task mutations.

**Worker 3 — task-003: Frontend Feature Gating:**
- Created `useLicenseFeatures()` hook — fetches `org.licenseFeatures`, caches result, provides `hasFeature()` helper.
- Hid Slack settings in OrgSettings when unlicensed.
- Hid Members and Field Permissions tabs in ProjectSettingsModal when unlicensed.
- Hid cron schedule fields in AutomationTab when unlicensed.

**Open follow-ups:**
- WorkflowTab role restriction UI still visible without license (missing from task-003 file list)
- AutomationTab cron input fields in create/edit form not fully gated (only display hidden)
- Test coverage for license gating needed

**Process:** Both workers 1 and 2 created `license.ts` — conflict resolved by reviewer keeping worker-1's version. All tasks merged on first review.

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
