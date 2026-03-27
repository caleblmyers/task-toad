# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-27 (Pipeline Hardening — post-Wave 70)

### SSE Real-Time Fix
- **Root cause found:** `compression()` middleware was buffering SSE `res.write()` calls — events stuck in gzip buffer until enough data accumulated
- SSE endpoint excluded from compression filter in `app.ts`
- `sseManager.broadcast()` now calls `res.flush()` after every write
- Heartbeat and initial connect events also flushed

### Action Plan UI Improvements
- Executing steps now use indigo styling (distinct from pending blue)
- Action-type-specific status messages while executing (e.g., "Writing code and committing to branch…", "AI is reviewing the code changes…")
- Added labels for all action types: fix_review, merge_pr, monitor_ci, fix_ci
- Stall detection: "Resume" button when plan is executing but no action is running
- Failed plan recovery: "Retry Plan" button for failed plans

### `merge_pr` Action Type (new)
- New executor: `apps/api/src/actions/executors/mergePR.ts` — squash merges PR via GitHub GraphQL API
- `mergePullRequest()` added to `githubPullRequestService.ts`
- Registered in executor registry, Zod schema, and planning prompt
- Pipeline now: `generate_code → create_pr → review_pr → fix_review → merge_pr`
- `create_pr` result now includes `pullRequestId` (GraphQL node ID) for merge step
- All action types default to `requiresApproval: false` — pipeline runs end-to-end

### Task Status Transitions from Action Plan
- Plan starts → task moves `todo` → `in_progress`
- `review_pr` starts → task moves `in_progress` → `in_review`
- Plan completes with merge/fix → task moves to `done`; review not approved → back to `in_progress`
- All transitions also update `sprintColumn` to keep board view in sync

### GitHub 401 Auto-Reauthentication
- `githubRequest()` accepts optional `installationId` — on 401, clears token cache, gets fresh token, retries
- New `githubRestRequest()` helper for REST endpoints with same 401 retry logic
- All GitHub services (`commitService`, `pullRequestService`, `repositoryService`, `issueService`) threaded through

### Action Executor Resilience
- Setup failures (branch creation, auth) now caught by outer try/catch — marks plan as `failed` with error message instead of leaving it stuck in `executing`
- SSE `task.action_plan_failed` event emitted so UI shows retry button immediately

### `fix_review` Executor Overhaul
- **Bug fix:** Was reading `reviewResult.comments` but data was nested under `reviewResult.review.comments` — never saw the 13 review comments
- Now fetches actual PR source code from GitHub for files mentioned in review
- Broadened scope: fixes security vulnerabilities, validation gaps, error handling — not just typos
- Holistic approach: AI considers how issues relate, makes judgment calls about fix vs defer
- Deferred tasks get clear, actionable descriptions

### `CodeReviewSchema` Fix
- `line` field now allows `null` (`z.number().nullable().optional()`) — AI returns null for file-level comments with no specific line

---

## 2026-03-27 (Wave 70 — actionable AI assistant)

### Wave 70: Actionable AI Assistant + Dependency Inference (3 workers, 5 tasks)

**Worker 1 — task-001: Actionable projectChat backend:**
- Extended `ProjectChatResponseSchema` with `suggestedActions` array (ChatActionSchema)
- Action types: `create_task`, `update_task`, `add_dependency`, `update_status`
- Updated projectChat prompt to instruct AI to suggest actions when warranted
- New `applyChatAction` mutation — executes the suggested action (creates tasks, updates status, adds deps)
- GraphQL types: `ChatAction`, `ChatActionInput`, `ApplyChatActionResult`

**Worker 1 — task-003: whatNext query:**
- New `whatNext` AI query — analyzes project state, returns prioritized suggestions
- Each suggestion has title, reason, priority, and a concrete ChatAction for one-click apply
- Suggestions prioritize unblocked tasks and dependency-unblocking work
- `WhatNextResponseSchema` with Zod validation

**Worker 2 — task-002: Chat Apply buttons frontend:**
- ProjectChatPanel renders suggested actions as buttons below each assistant message
- Apply button calls `applyChatAction` mutation, shows success/failure toast
- Applied actions disabled with green "Applied" state
- Task references now clickable (navigate to task detail)

**Worker 3 — task-004: What's Next? panel:**
- New WhatNextPanel component — fetches whatNext query, displays suggestion cards
- Each card: title, reason, priority badge, Apply button
- "What's Next?" button added to project toolbar AI dropdown
- Task list refreshes after applying suggestions

**Worker 3 — task-005: Dependency inference in planner:**
- Added `reason` field to hierarchical plan dependency schema
- Prompt updated to instruct AI to explain why each dependency exists
- Existing resolver already handled dependency creation with cycle detection

**Process:** task-005 had 2 rejections — task description incorrectly claimed dependencies weren't implemented (they were). Worker eventually found the scope was just adding the `reason` field. task-004 required modifying ProjectToolbar.tsx (not in file list). All other tasks merged on first review.

### Open follow-ups
- Chat actions: input validation for applyChatAction (verify taskId belongs to project)
- Chat actions: activity log entries when tasks created/updated via chat
- WhatNextPanel: refresh button after applying actions
- ProjectChatPanel: wire onSelectTask prop from ProjectDetail

---

## 2026-03-26 (Wave 69 — follow-up cleanup)

### Wave 69: Follow-Up Cleanup (3 workers, 3 tasks)

**Worker 1 — task-001: Pipeline transition fix + context wiring:**
- Fixed in_review → done transition: task now transitions to `done` when review is approved or fix_review completes. Orchestrator triggers downstream tasks automatically.
- Wired `upstreamTaskContext`, `previousStepContext`, and `failureContext` to writeDocs.ts and fixReview.ts (previously only generateCode had them)
- Fixed fixReview.ts: now passes `ctx.userGitHubToken` to commitFiles

**Worker 2 — task-002: Session race condition + webhook userId:**
- Session progress updates now use atomic SQL via `$executeRaw` with `jsonb_set` — no more read-modify-write race under concurrent plan completions
- All three counters (tasksCompleted, tasksFailed, tasksSkipped) use atomic increments
- Webhook handler resolves org admin userId instead of hardcoded `'system'` string

**Worker 3 — task-003: Quick fixes bundle (6 items):**
- Removed `(args as Record<string, unknown>).config` type cast in scaffoldProject resolver
- Replaced type assertion in projectChat with proper Prisma select for completionSummary
- Removed dead `generateOnboardingQuestions` and `saveOnboardingAnswers` from GraphQL schema + resolvers
- Fixed ProjectDetail.tsx lint warning (extracted useEffect dependencies from `d`)
- Added error display in SessionDialog (inline error message on create/start failure)
- Wired analyzeIntent textarea: saves as KB entry before bootstrapProjectFromRepo

**Process:** All 3 tasks merged on first review — zero rejections. Lint now shows 0 warnings.

---

## 2026-03-26 (Wave 68 — Phase 3: orchestration)

### Wave 68: Phase 3 Orchestration — Sessions + GitHub Bridge + Re-planning (3 workers, 5 tasks)

**Worker 1 — task-001: GitHub → orchestrator bridge:**
- Webhook handler now emits `task.updated` events after PR merges, PR review approvals, issue closes, and issue reopens
- Uses `'system'` as userId for webhook-triggered events
- Orchestrator automatically triggers downstream task execution when PRs are merged on GitHub
- Closes the automation loop: TaskToad → GitHub → TaskToad

**Worker 1 — task-002: Re-planning on failure:**
- New `replanFailedTask` mutation — takes a failed plan, includes failure context in AI prompt, generates new plan with different approach
- Old plan cancelled, new plan created with proper action ID remapping
- AI sees: "Previous plan failed because X. Generate a new plan that avoids these failures."

**Worker 2 — task-003: Session model + CRUD:**
- New `Session` Prisma model: id, projectId, status, config (JSON), taskIds (JSON), progress (JSON), timestamps
- Session config: autonomyLevel, budgetCapCents, failurePolicy, maxRetries, scopeLimit, timeLimitMinutes
- GraphQL types + queries (`sessions`, `session`) + mutations (`createSession`, `startSession`, `pauseSession`, `cancelSession`)
- `startSession` marks included tasks as `autoComplete: true` and triggers orchestration
- Resolver registered in schema.ts with relations on Project, Org, User

**Worker 2 — task-004: Session-aware orchestrator:**
- Orchestrator filters eligible tasks to session tasks when a session is running
- Budget cap check: pauses session when estimated cost exceeds cap
- Scope limit check: completes session when task count reached
- Failure policy: `pause_immediately`, `skip_and_continue`, `retry_then_pause`
- Session progress updated on plan completion/failure
- Session event types: `session.started`, `session.completed`, `session.failed`, `session.paused`
- `session.started` event triggers initial orchestration

**Worker 3 — task-005: Session UI:**
- "Start Session" button on ExecutionDashboard
- Session creation dialog: task selection checkboxes + config form (autonomy, budget, failure policy)
- Active session banner: progress display, pause/cancel controls
- SSE event listeners for real-time session status updates

**Process:** No issues.md — clean wave, all 5 tasks merged without rejections.

### Open follow-ups
- Session progress: tokensUsed and estimatedCostCents never updated (initialized to 0)
- Session time limit not enforced by orchestrator
- replanFailedTask duplicates plan creation logic from commitActionPlan — extract shared helper
- Session progress race condition (non-atomic JSON read/increment/write)
- Test coverage for sessions (CRUD, orchestration, budget/scope, failure policy)
- SessionDialog error handling (create/start failures silently caught)
- Webhook userId 'system' — verify orchestrator handles gracefully

---

## 2026-03-26 (Wave 67 — Phase 2: context threading)

### Wave 67: Phase 2 Context Threading (3 workers, 5 tasks)

**Worker 1 — task-001: Execution result forwarding:**
- Added `previousStepContext` to ActionContext — formatted summaries of completed actions in the plan
- actionExecutor builds summaries from completed action results (summary + file list)
- generateCode, writeDocs, fixReview executors prepend step context to knowledge context for AI
- Second `generate_code` step now knows what the first step built

**Worker 1 — task-003: Upstream task context wiring:**
- Added `upstreamTaskContext` to ActionContext
- actionExecutor loads `completionSummary` from upstream dependency tasks (blocks/informs links)
- Formats upstream context: whatWasBuilt, filesChanged, apiContracts, keyDecisions, gotchas
- generateCode prepends upstream context before previousStepContext in knowledge context
- Task #5 now receives structured context from tasks #1-4

**Worker 2 — task-002: Cross-task completion summaries:**
- Added `completionSummary` field to Task model (migration)
- New `TaskCompletionSummarySchema` in aiTypes: whatWasBuilt, filesChanged, apiContracts, keyDecisions, gotchas, dependencyInfo
- New `generateCompletionSummary` AI function in aiService
- actionExecutor generates and stores completion summary when plan completes (non-blocking)

**Worker 2 — task-004: Failure context propagation:**
- Failed actions now store structured context in result field (error, errorCode, isRetryable, timestamp)
- Added `failureContext` to ActionContext
- On retry, previous failure context is loaded and passed to executor
- generateCode tells AI: "Previous attempt failed because X. Try a different approach."

**Worker 3 — task-005: projectChat upgrade:**
- projectChat now uses `retrieveRelevantKnowledge()` instead of legacy `project.knowledgeBase` field
- Task dependencies (blockedBy/blocks) included in AI context
- Completion summaries from done tasks included in AI context

**Process:** task-004 had merge conflict with task-003 (both added fields to ActionContext/types.ts). Sent back for rebase. All other tasks merged on first review.

### Open follow-ups
- Task status → done transition: completionSummary generated at plan completion (→ in_review) but orchestrator triggers on status → done. Verify transition happens.
- writeDocs/fixReview need upstreamTaskContext and failureContext wired in (only generateCode got them)
- Test coverage for context threading (previousStepContext, upstream loading, failure round-trip, completion summary)
- projectChat completionSummary type assertion — replace with proper Prisma include after migration
- Rate limiting for completionSummary AI calls

---

## 2026-03-26 (Wave 66 — Phase 1.5: onboarding redesign)

### Wave 66: Phase 1.5 Onboarding Redesign (3 workers, 5 tasks)

**Worker 1 — task-001: Backend AI stack recommendations:**
- New `recommendStack` AI feature — takes project name + description, returns recommended stack with rationale + 2-3 alternatives
- Each recommendation includes structured config: framework, language, packages, projectType
- New `StackRecommendationSchema` in aiTypes.ts
- `scaffoldProject` mutation now accepts `ScaffoldConfigInput` (structured config) instead of `template` string
- `buildScaffoldPrompt` generates natural language stack description from config
- Removed `scaffoldTemplates` hardcoded query
- New `recommendStack` GraphQL query

**Worker 1 — task-004: AI context files in scaffold:**
- Updated scaffold prompt to always generate `CLAUDE.md` at repo root
- CLAUDE.md includes project name, dev commands, tech stack, directory structure
- File limit increased from 3-5 to 4-7 to accommodate context files

**Worker 2 — task-002: ProjectSetupWizard rewrite:**
- Replaced hardcoded template grid with AI recommendation step
- Shows recommended stack (prominent card with rationale) + alternatives (smaller cards)
- Custom option: text input for "Or describe what you want"
- New `analyze` step for existing repos: optional intent prompt → `bootstrapProjectFromRepo`
- Pre-fetches recommendation in background during GitHub step
- Updated all 15 tests to match new wizard behavior (rejected on first review for stale tests, fixed and re-submitted)

**Worker 3 — task-003: Interview removal + context textarea:**
- Deleted `OnboardingWizard.tsx` component
- Removed all OnboardingWizard triggers from ProjectDetail.tsx
- Removed `showOnboarding` from navigation state
- Added optional "Additional context" textarea to NewProject page
- Additional context saved as KnowledgeEntry after project creation

**Worker 3 — task-005: KB seeding from stack choice:**
- After successful scaffold, creates KB entry with tech stack details (framework, language, packages, project type)
- Source: 'scaffold', category: 'architecture'

**Process:** task-002 rejected once (8 stale tests), fixed and re-merged. task-005 used type cast workaround for cross-worker dependency. All other tasks merged on first review.

### Open follow-ups
- Clean up redundant type cast in scaffoldProject resolver (`(args as Record<string, unknown>).config`)
- Wire analyzeIntent textarea to bootstrapProjectFromRepo mutation (collects input but doesn't pass it)
- Remove dead backend mutations (`generateOnboardingQuestions`, `saveOnboardingAnswers`)

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

- **2026-03-26** — Wave 65: Phase 1 follow-ups — commitFiles error handling, concurrency guard, OAuth routing, fix_review executor, Modal tests, act() fix, plan validation.
- **2026-03-23** — Wave 56: Bug fixes from production testing — priority persistence, workflow restriction model, saved view filters, release burndown, silent auth failures, + 3 hotfixes.
- **2026-03-25** — Wave 63: Quick hits — closed-source cleanup (LICENSE, CONTRIBUTING, TASKTOAD_LICENSE, Docker), modal dismiss fix, session security fix.
- **2026-03-25** — Wave 62: Deferred refactors — useEditableField (R2), tab extraction (R8), picker consolidation (R9), metrics calc (R6), queries split (R11), chart utilities (R12).
- **2026-03-25** — Wave 61: Pre-pipeline refactors — token manager (R1), event helpers (R4), unused exports (R14), custom project option.
- **2026-03-24** — Wave 60: Scaffolding + licensing follow-ups — default branch fix, template registry, KB auto-populate, wizard tests, orgPlan, Plans tab.
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
