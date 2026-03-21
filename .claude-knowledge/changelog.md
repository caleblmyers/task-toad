# Daily Development Changelog

Summaries of work completed each session. Most recent first. Only the last 5 waves are detailed — older entries are one-liners (see git history for full details).

---

## 2026-03-21 (security phase 2)

### Wave 42: Security Phase 2 — Auth Hardening (3 workers, 5 tasks)

**Worker 1 — H-1 Backend + Frontend (task-001, task-002):**
- JWT migration from localStorage to HttpOnly cookies: 15-min access token + 7-day refresh token with rotation
- `POST /api/auth/refresh` endpoint with hashed refresh token storage (`RefreshToken` model concept via tokenVersion)
- Cookie options: `HttpOnly`, `Secure` (prod), `SameSite=Strict`, `Path=/api`
- CSRF protection: middleware on `POST /graphql` requires `X-Requested-With` header (403 without)
- Frontend: removed localStorage token storage, `gql()` sends `X-Requested-With: XMLHttpRequest`, credential: 'include'
- Auto-refresh: `client.ts` intercepts 401, calls `/api/auth/refresh`, retries original request (once)
- `useEventSource.ts` updated to use cookie auth (removed token query params)
- `context.ts` reads `access_token` cookie with `Authorization` header fallback

**Worker 2 — H-6: Pagination Caps (task-003):**
- `Math.min(limit, 100)` enforced on all list query resolvers across task, sprint, comment, notification, report, webhook, slack, knowledge base, search, AI prompt history, and release queries
- Consistent capping pattern: resolvers clamp user-provided limit before passing to Prisma

**Worker 3 — H-3 + H-4 + H-9 + H-10 + H-12 (task-004, task-005):**
- Webhook secrets encrypted at rest via AES-256-GCM (`encryptField`/`decryptField` in encryption.ts)
- Slack webhook URLs encrypted at rest, masked in query responses
- Invite tokens hashed with SHA-256 before DB storage (`hashToken()` in encryption.ts)
- `acceptInvite` resolver compares against hashed token
- Advisory lock SQL migrated from `$queryRawUnsafe` to `$queryRaw` tagged template literals
- `setOrgApiKey` mutation requires `confirmPassword` argument for re-authentication

**Process:** All 5 tasks merged cleanly with zero rejections. Worker-1 handled two sequential tasks (backend then frontend) on same branch — squash merge correctly deduped.

**Security findings resolved:** H-1, H-2, H-3, H-4, H-6, H-9, H-10, H-12 (all 8 remaining High items). Also resolves L-1 (JWT expiry) and L-9 (SameSite cookie).

**Open follow-ups:**
- Data migration scripts needed: encrypt existing plaintext webhook secrets/Slack URLs, hash existing invite tokens
- Signup mutation should also set HttpOnly cookies (currently only login and resetPassword do)
- Integration tests for cookie-based auth flow and CSRF protection
- Auto-refresh loop protection: failed refresh redirects to /login, could lose unsaved work
- L-5 (concurrent session limit) now feasible with tokenVersion + refresh tokens

---

## 2026-03-20 (auto-complete redesign)

### Wave 41: Auto-Complete Redesign — Polish / Final Wave (3 workers, 6 tasks)

**Worker 1 — 6-A: Execution Dashboard:**
- `projectActionPlans(projectId, status?)` backend query with task context and action details
- `ExecutionDashboard.tsx` component: stat cards (executing/queued/completed/failed), plan list with status badges + progress bars, expandable action steps with status icons, status filter buttons
- Wired into ProjectDetail as lazy-loaded panel via ProjectToolbar overflow menu
- SSE real-time: added `task.action_plan_failed`, `task.blocked`, `task.unblocked` to SSE_EVENTS, auto-refetch on any execution event
- Retry button on failed plans, Cancel button on executing plans (new `cancelActionPlan` mutation)

**Worker 2 — 6-B: Insight Review UI + Notifications:**
- `InsightPanel.tsx` component in taskdetail: fetches insights for task, type badges (discovery=blue, warning=amber, pattern=purple), dismiss/apply actions, source/target context, relative timestamps
- Insights tab in TaskDetailPanel with count badge, auto-shown for autoComplete tasks
- Apply insight appends content to task instructions
- Toast notifications for execution events: plan_completed (success), plan_failed (error), blocked (info)
- ToastContainer wired into ProjectDetail SSE listener

**Worker 3 — 6-C: Manual Task Specs + Auto-Start:**
- `ManualTaskSpecSchema` Zod schema: filesToChange (path/action/description), approach (steps), codeSnippets (file/language/code/explanation), testingNotes, dependencies
- `buildManualTaskSpecPrompt` prompt builder with KB + repo file context
- `generateManualTaskSpec` mutation — loads task+project, KB retrieval, repo files, returns rich spec
- `ManualTaskSpecView.tsx` component: collapsible code snippets in dark blocks, file action badges, numbered approach steps, dependency pills
- `autoStartProject` mutation — creates GitHub repo if needed, triggers orchestrator for all autoComplete=true tasks
- Auto-Start button in ProjectToolbar (only shown with GitHub installation)

**Process:** 1 rebase needed (task-006 conflicted with task-004 in TaskDetailPanel.tsx). Zero code quality rejections. Clean independent merges for all first-tasks.

**Open follow-ups:**
- ExecutionDashboard stats count from filtered list (should use separate all-plans query)
- ManualTaskSpec: DataLoader type missing acceptanceCriteria (uses cast workaround)
- No dependency visualization between plans in dashboard
- cancelActionPlan doesn't interrupt actively executing actions
- Insights tab count badge duplicates InsightPanel fetch

**AUTO-COMPLETE PIPELINE REDESIGN COMPLETE (Waves 36-41)**
Full pipeline: KB context → onboarding interview → hierarchical planning → parallel auto-execution → CI monitoring → failure handling → insights generation → execution dashboard → manual task specs → auto-start.

---

### Wave 40: Auto-Complete Redesign — Orchestration + CI Fix (3 workers, 6 tasks)

**Worker 1 — 5-A: Status-Driven Events:**
- New event types: `task.action_plan_failed`, `task.blocked`, `task.unblocked` in eventbus types
- `actionExecutor.ts` emits `task.action_plan_failed` when plan status set to 'failed'
- Orchestrator listener handles `task.action_plan_failed` — finds dependents via TaskDependency, emits `task.blocked` for autoComplete=true tasks
- Notification listener creates `action_plan_failed` and `task_blocked` notifications for task assignees
- SSE listener broadcasts all three new events for real-time frontend updates

**Worker 2 — 5-B: TaskInsight Model + Generation:**
- New `TaskInsight` Prisma model (`taskinsight.prisma`): sourceTaskId, targetTaskId, type (discovery/warning/pattern), content, autoApplied
- Migration: `add_task_insights`
- `TaskInsightItemSchema` + `TaskInsightsResponseSchema` Zod schemas, `generateTaskInsights` AIFeature + FEATURE_CONFIG
- `buildGenerateTaskInsightsPrompt` prompt builder — analyzes generated code for discoveries, warnings, patterns targeting sibling tasks
- `generateTaskInsights` AI service function
- GraphQL: `taskInsights(projectId, taskId?)` query, `dismissInsight` mutation, field resolvers
- ActionExecutor hook: after successful `generate_code`, loads sibling tasks, generates insights, creates records (wrapped in try/catch — never blocks pipeline)

**Worker 3 — 5-C: CI Monitor + Auto-Fix + Test Fix:**
- Fixed flaky `export.integration.test.ts` — root cause was missing DATABASE_URL in vitest config (not token version as suspected)
- `monitor_ci` executor: polls GitHub check runs via REST API with in-process sleep loop (30s intervals, max 30 min)
- `fix_ci` executor: fetches CI error annotations, calls AI to generate fix, commits to same branch (one retry limit)
- `monitor_ci` and `fix_ci` added to ActionType union + registered in actions/index.ts
- Planning prompt updated with new action types and sequencing rules

**Process:** Zero code quality rejections. Reviewer noted task-005 (test fix) was over-prescribed — debugging tasks should describe symptoms and let workers investigate. monitor_ci uses in-process sleep vs job queue re-enqueue (follow-up).

**Open follow-ups:**
- monitor_ci: make resilient to process restarts via job queue re-enqueue
- TaskInsight: add DataLoader for sourceTask/targetTask field resolvers
- Planning prompt: validate monitor_ci/fix_ci source action IDs in schema
- merge-worker.sh: fix script treating lint warnings as failures

---

### Wave 39: Auto-Complete Redesign — Execution Pipeline + Follow-ups (3 workers, 5 tasks)

**Worker 1 — 4-A + 4-B: Project Orchestrator + Parallel Execution:**
- New `orchestratorListener.ts` — registers on `task.action_plan_completed` and `task.updated` events
- Finds auto-eligible tasks (`autoComplete=true`, `status=todo`, all blockers `done`), generates action plans, enqueues first action
- Advisory lock per project (`PROJECT_ORCHESTRATOR` in LOCK_IDS) prevents concurrent orchestration
- Concurrency limit of 3 executing plans per project
- Enqueues ALL eligible tasks up to remaining concurrency slots (parallel, not sequential)
- Branch naming changed from `task-{taskId}-ai` to `task-{taskId}-{slug}` (title-derived, lowercase, max 30 chars)
- Branch conflict retry with random 4-char suffix on 422
- `registerListeners` updated to accept `prisma` param for orchestrator

**Worker 2 — 4-C: AI-Enriched PR Descriptions:**
- `buildEnrichPRDescriptionPrompt` expanded: project name/description, KB entries, parent task/epic context, acceptance criteria, code summary
- `enrichPRDescription` AI service function accepts new optional context params
- `createPR` executor passes full ActionContext (knowledgeContext, project info, codeSummary from generate_code result, parent task title)
- `createPullRequestFromTask` in githubService accepts `enrichContext` with all new fields
- PR sections: Summary, Changes, Context (task/epic rationale), Testing (from acceptance criteria)

**Worker 3 — Follow-ups from Waves 37-38:**
- PlanDependencyEditor wired into HierarchicalPlanEditor — clicking dep badge toggles inline editor below node, `updateNodeDeps` callback updates plan state immutably
- HierarchicalPlanDialog: regenerate button now reveals feedback textarea in editing state instead of returning to prompt
- Aria labels on expand/collapse (`aria-expanded`) and delete buttons (`aria-label="Delete epic '...'"`)
- Exhaustive-deps lint warning fixed (reduced warnings 5→4)
- "Run Interview" button added to KnowledgeBasePanel header, wired to onboarding modal in ProjectDetail

**Process:** Zero code quality rejections. Worker-1 sequential tasks merged as single branch (same issue as Wave 38). Pre-existing test isolation issue in `export.integration.test.ts` blocked merge validation script.

**Open follow-ups:**
- Fix flaky `export.integration.test.ts` (401s in full suite, passes individually)
- `setExpandedIds` in useEffect still triggers `react-hooks/set-state-in-effect` warning
- Orchestrator observability/metrics not yet added
- PlanDependencyEditor doesn't render for subtask-level nodes

---

### Wave 38: Auto-Complete Redesign — Intelligent Planning (3 workers, 6 tasks)

**Worker 1 — 3-A: Hierarchical Plan Generation:**
- `HierarchicalPlanResponseSchema` Zod schema: 3-level structure (epics→tasks→subtasks) with `dependsOn: Array<{title, linkType}>` for typed dependency inference
- `buildHierarchicalPlanPrompt` prompt builder with `userInput()` safety, deduplication, KB context
- `generateHierarchicalPlan` AI service function + `generateHierarchicalPlan` AIFeature + FEATURE_CONFIG (32K tokens, 24h cache)
- `previewHierarchicalPlan` GraphQL query — loads project, fetches KB via `retrieveRelevantKnowledge`, calls AI, returns preview
- `HierarchicalEpicPreview`, `HierarchicalTaskPreview`, `HierarchicalSubtaskPreview`, `DependencyRef` GraphQL types

**Worker 2 — 3-B: Plan Commit + Batch Cycle Detection:**
- `batchDetectCycles()` in `cyclicDependencyCheck.ts` — validates all proposed edges against existing graph + each other in-memory, normalizes `is_blocked_by` to `blocks` direction, skips non-blocking types
- `commitHierarchicalPlan` mutation — creates 3-level hierarchy in `prisma.$transaction`, resolves `dependsOn` titles to IDs, calls `batchDetectCycles` before creating `TaskDependency` records, respects `autoComplete` toggles
- `CommitHierarchicalEpicInput`, `CommitHierarchicalTaskInput`, `CommitHierarchicalSubtaskInput`, `DependencyRefInput` GraphQL input types

**Worker 3 — 3-C: Plan Editor UI:**
- `HierarchicalPlanEditor.tsx` — recursive tree view with depth-based indentation, expand/collapse, inline title editing (click→input→blur/Enter/Escape), autoComplete toggle checkboxes, priority badges, dependency count badges, delete buttons, HTML5 drag-to-reorder within same level
- `HierarchicalPlanDialog.tsx` — 3-state modal (prompt input → editing → committing), Generate/Regenerate/Commit flow
- `PlanDependencyEditor.tsx` — inline dependency picker with search, link type dropdown (blocks/informs)
- GraphQL queries added to `queries.ts`, triggered from ProjectToolbar overflow menu

**Process:** One rebase needed (task-004 conflicted with task-002 in typedefs). Zero code quality rejections. Worker-3 defined local TypeScript interfaces to avoid backend dependency — merged independently.

**Open follow-ups:**
- PlanDependencyEditor not wired into node rendering (badges show count but don't open editor on click)
- HierarchicalPlanDialog missing feedback textarea for "Regenerate with feedback"
- Exhaustive-deps lint warning in HierarchicalPlanEditor useEffect
- Missing aria-labels on expand/collapse and delete buttons
- No integration tests for preview/commit resolvers or unit tests for batchDetectCycles

## Older Entries (one-line summaries)

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
