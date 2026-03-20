# TaskToad — Remaining Work & Tracking

Production deployed at `https://tasktoad-api-production.up.railway.app`. 37 swarm waves completed. All P0 and most P1 competitive gap items done. All 5 Critical security findings fixed. Current phase: Auto-Complete Pipeline Redesign (Waves 36-37 done, Waves 38-41 planned).

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Priority Order

1. Manual testing (12 test groups below) — find real bugs
2. Security Phase 2 (High items) — auth hardening swarm wave
3. Remaining ops (UptimeRobot, SMTP, Railway health check)
4. Security Phase 3-4 (Medium + Low)
5. Remaining P1 features (automation, scheduled reports, SLA)
6. P2 features — only after everything above is solid

---

## Deployment & Ops

### Infrastructure (Railway)
- [x] Railway project (`blissful-insight`), Postgres addon, API service (`tasktoad-api`)
- [x] Auto-deploys from GitHub on push to `main`
- [x] Env vars: DATABASE_URL, JWT_SECRET, ENCRYPTION_MASTER_KEY, CORS_ORIGINS, NODE_ENV, GITHUB_APP_*, SENTRY_DSN
- [x] Public domain: `tasktoad-api-production.up.railway.app`
- [x] Frontend served as static files from API service
- [x] Health check passing: `/api/health`
- [ ] Railway health check in service settings (auto-restart on failure)
- [ ] Custom domain (optional — Railway domain works for beta)

### Observability
- [x] Sentry DSN set on production
- [ ] Verify Sentry receives errors in production
- [ ] UptimeRobot monitor: HTTP check on `/api/health` every 5 min

### Email (optional for beta)
- [ ] SMTP provider configured (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
- [ ] Email verification and password reset flows tested

### Security
- [x] JWT_SECRET is strong random hex
- [x] ENCRYPTION_MASTER_KEY is random 64-char hex
- [x] CORS_ORIGINS set to production domain only
- [x] No secrets committed to git
- [x] All 5 Critical security findings fixed (Wave 35)

---

## Manual Testing Plan

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

## Security Audit — Remaining Items

Full report: `.claude-knowledge/security-audit.md` (2026-03-20, 39 findings total)

**Resolved (Wave 35):** C-1, C-2, C-3, C-4, C-5, H-5, H-7, H-8, H-11 — 9 of 39 findings fixed.

### Phase 2 — High (Next Swarm Wave: Auth Hardening)

- [ ] **H-1: JWT in localStorage → HttpOnly cookies** — Migrate to `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Short-lived access tokens (15-30 min) + refresh token rotation. *(Full auth rework: client.ts, context.ts, auth.ts, App.tsx)*
- [ ] **H-2: CSRF protection** — Require custom header (`X-Requested-With`) on all mutations, or implement CSRF tokens. *(File: app.ts)*
- [ ] **H-3: Encrypt webhook secrets at rest** — Use existing `encryption.ts` AES-256-GCM. *(File: webhook.prisma, webhook resolvers)*
- [ ] **H-4: Encrypt Slack webhook URLs at rest** — Use existing encryption utility. *(File: slack.prisma, slack resolvers)*
- [ ] **H-6: Pagination caps on list queries** — Enforce `Math.min(args.limit ?? 50, 100)` on all list resolvers.
- [ ] **H-9: Hash invite tokens before storage** — Use same `hashToken()` pattern as password reset tokens. *(File: auth.ts)*
- [ ] **H-10: Fix $queryRawUnsafe in advisory locks** — Switch to `prisma.$queryRaw` tagged template literals. *(File: advisoryLock.ts)*
- [ ] **H-12: Re-authentication for sensitive operations** — Add `confirmPassword` argument to `setOrgApiKey`. *(File: org.ts resolvers)*

### Phase 3 — Medium

- [ ] **M-1: Disable GraphQL introspection in production** — Check `NODE_ENV` in schema.ts.
- [ ] **M-2: Per-org AI rate limiting** — Add per-org throttle (e.g., 5 AI requests/hour).
- [ ] **M-3: Content-Disposition header injection** — Use RFC 5987 encoding for export filenames.
- [ ] **M-4: File upload magic byte validation** — Use `file-type` library. *(File: upload.ts)*
- [ ] **M-5: Scope DataLoaders by orgId** — Add orgId to DataLoader keys. *(File: loaders.ts)*
- [ ] **M-6: Audit logging for sensitive operations** — Log setOrgApiKey, createWebhookEndpoint, connectSlack, linkGitHubInstallation.
- [ ] **M-7: Redact emails in exports by default** — Add `includeEmails` opt-in parameter.
- [ ] **M-8: Saved filter mutations skip orgId validation** — Validate filter's project belongs to user's org.
- [ ] **M-9: Input length validation on text fields** — Zod `.max()`: title (200), description (10000).
- [ ] **M-10: Webhook replay prevention** — Add unique `X-Webhook-Delivery-ID` header.

### Phase 4 — Low

- [ ] **L-1: Reduce JWT expiry + refresh tokens** — Depends on H-1.
- [ ] **L-2: Email enumeration on signup** — Accept trade-off or switch to silent success.
- [ ] **L-3: URL-encode GitHub file paths** — `encodeURIComponent(path)`. *(File: githubFileService.ts)*
- [ ] **L-4: Remove console.error in production ErrorBoundary** — Route to Sentry.
- [ ] **L-5: Concurrent session limit** — Track sessions, view/terminate. *(Depends on C-1)*
- [ ] **L-6: Unicode homograph in filenames** — NFKD normalize + ASCII whitelist.
- [ ] **L-7: Bulk mutation item count limit** — Cap `bulkUpdateTasks` at 100.
- [ ] **L-8: Reduce GraphQL depth limit** — Lower from 10 to 6-7.
- [ ] **L-9: SameSite cookie attribute** — Depends on H-1.
- [ ] **L-10: Cap Retry-After parsing** — Max 1 hour. *(File: githubAppClient.ts)*
- [ ] **L-11: Null byte stripping on REST endpoints** — Apply globally via middleware.
- [ ] **L-12: Test database credentials in CI/CD** — Require `TEST_DATABASE_URL`.

---

## Remaining Polish

- [ ] Shared-types expansion — add Report type to `@tasktoad/shared-types`
- [ ] S3 multipart upload — current 10MB limit uses single PUT
- [ ] useAsyncData adoption — migrate components with inline fetch-in-useEffect
- [ ] Release burndown chart — task completion over time for releases
- [ ] Unit tests for `urlValidator.ts` — private IP ranges, DNS mocking, protocol/port blocking
- [ ] Frontend: disable task field editing when user lacks EDIT_TASKS permission
- [ ] BacklogView keyboard navigation (Enter/Space to select task)
- [ ] ~3 dynamic mutations remain inline in useTaskOperations.ts
- [ ] SavedViewPicker lint warning: setState in useEffect

---

## Auto-Complete Pipeline Redesign

Full design spec: `~/brain/projects/task-toad/auto-complete-redesign.md`

Transforms Auto-Complete from isolated per-task execution into project-level orchestration: knowledge base for context, hierarchical planning (epics→tasks→subtasks), cross-task dependency triggers, parallel auto-execution, and smart error recovery.

### Wave 36 — Foundation: Schema + Retrieval (DONE)
- [x] **1-A: Knowledge Base Schema + CRUD** — `KnowledgeEntry` model, GraphQL CRUD, DataLoader, migration
- [x] **1-B: KB Retrieval Function** — `retrieveRelevantKnowledge()` (≤3 returns all, else AI picks top 5-8 by title)
- [x] **1-C: autoComplete flag + informs link type** — `autoComplete` on Task, `informs` in DependencyLinkType

### Wave 37 — Foundation: UI + Wiring (DONE)
- [x] **2-A: KnowledgeBasePanel** — List entries with category badges, add/edit/delete, file upload (.txt/.md via FileReader). Migration button for old `project.knowledgeBase` text field → single entry. Replace existing KnowledgeBaseModal.
- [x] **2-B: Onboarding Interview** — `generateOnboardingQuestions`/`saveOnboardingAnswers` mutations. AI generates contextual questions. Multi-step wizard component, local state only. Saves Q&A as KnowledgeEntry(source='onboarding'). Auto-opens after project creation.
- [x] **2-C: Inject KB Retrieval into Pipelines** — `knowledgeContext` on ActionContext. `retrieveRelevantKnowledge()` in actionExecutor. Wired into generateCode + writeDocs executors + planning prompt builder. Fallback to `project.knowledgeBase`.

**Wave 37 follow-ups** (out of scope, add to future waves):
- [ ] "Refresh from repo" in KnowledgeBasePanel still writes to legacy `project.knowledgeBase` — update to create/update a KnowledgeEntry instead
- [ ] Add "Run Interview" button inside KnowledgeBasePanel (currently only in ProjectToolbar overflow menu)
- [ ] Onboarding wizard keyboard navigation (Enter to advance, Escape to close)
- [ ] KB entry search/filter in KnowledgeBasePanel when entry count grows large

### Wave 38 — Intelligent Planning
- [ ] **3-A: Hierarchical Plan Generation** — New prompt builder outputting epic→task→subtask hierarchy with dependency inference (`blocks`/`informs` using title references). Zod schema. `generateHierarchicalPlan` AI service function. `previewHierarchicalPlan` query.
- [ ] **3-B: Plan Commit with Hierarchy + Dependencies** — `commitHierarchicalPlan` mutation. Creates epics→tasks→subtasks via parentTaskId, TaskDependency records, autoComplete toggles. Batch cycle detection. `prisma.$transaction`. *(Depends: 3-A)*
- [ ] **3-C: Plan Editor UI** — Tree view with editable nodes, autoComplete toggles, dependency badges, drag-to-reorder, commit button. `PlanDependencyEditor` for inline dependency picker. *(Depends: 3-A)*

### Wave 39 — Execution Pipeline
- [ ] **4-A: Project-Level Orchestrator** — Event-driven: listens to `task.action_plan_completed` + `task.updated(status→done)`. Finds auto-eligible tasks with all blockers completed. Generates action plan if none, then executes. Advisory lock per project. Concurrency limit (default 3).
- [ ] **4-B: Parallel Execution + Branch Naming** — Orchestrator enqueues ALL eligible tasks. Branch naming: `task-{taskId}-{slug}` (kebab-case first 30 chars). Handle concurrent branch creation (retry on conflict). *(Depends: 4-A)*
- [ ] **4-C: PR Description Generation** — AI-enriched PR descriptions (what changed, why, task/epic context, testing notes). Verify KB context flows through full pipeline.

### Wave 40 — Orchestration
- [ ] **5-A: Status-Driven Events** — Orchestrator handles failure (block dependents, attach error context). New events: `task.blocked`, `task.unblocked`. Notification creation for blocked chains.
- [ ] **5-B: TaskInsight Model + Generation** — `TaskInsight` model (sourceTaskId, targetTaskId, type: discovery/warning/pattern, content, autoApplied). Typedefs, resolvers, prompt builder. Call insight extraction after generate_code completes. Migration.
- [ ] **5-C: CI Monitor + Auto-Fix** — `monitor_ci` executor (polls GitHub Actions, re-enqueues with delay, max 30 min). `fix_ci` executor (fetch CI logs → AI fix → commit to same branch, one retry). Update ActionType union, registry, action plan prompt.

### Wave 41 — Polish
- [ ] **6-A: Execution Dashboard** — Frontend view of all auto-completing tasks (executing/queued/completed/failed), dependency visualization, retry/cancel controls. `useExecutionDashboard` hook.
- [ ] **6-B: Insight Review UI + Notifications** — `InsightPanel` (apply/dismiss insights). Execution notification toasts. Wire into TaskDetailPanel + useEventSource.
- [ ] **6-C: Manual Task Specs + Auto-Start** — Rich spec generation for manual tasks (files to change, approach, code snippets, KB entries, acceptance criteria). Bootstrap mode: create repo if needed before execution. `autoStartProject` mutation.

### Verification Checklist (per wave)
- `pnpm typecheck && pnpm lint && pnpm build && pnpm test` all pass
- Schema waves: `npx prisma generate` succeeds, migration included
- Wave 37: Create project, run onboarding, upload doc, verify entries in KB
- Wave 38: Generate hierarchical plan, verify tree with dependencies in plan editor
- Wave 39: Mark 2 independent tasks auto-eligible, complete blocker, verify both start in parallel
- Wave 40: Fail a task → dependents blocked + notification. Complete task → insights generated.
- Wave 41: Execution dashboard shows real-time status via SSE

### Key Design Decisions
- **KB retrieval:** Claude picks from entry titles (no pgvector yet). Plan for pgvector migration later at client scale.
- **Execution model:** Parallel for independent auto-eligible tasks, project-level concurrency limit of 3.
- **Onboarding interview:** Frontend state only, restart on tab close, save to KB on completion.
- **CI polling:** monitor_ci executor re-enqueues with setTimeout delay (cap 30 min).
- **Deprecation path:** `project.knowledgeBase` text field kept as fallback; retrieval checks entries first.
- **Branch naming:** `task-{taskId}-{slug}` prevents conflicts during parallel execution.

---

## Remaining P1 Features (Deferred)

- [ ] **SLA tracking** — SLAPolicy + SLATimer models. Evaluate on status transitions. *(Niche for MVP — revisit when customers ask)*
- [ ] **Multi-action automation rules** — Change action field to array. New action types: send_webhook, add_label, add_comment, set_due_date.
- [ ] **Compound automation conditions** — Reuse FilterGroup from search. *(Depends on compound filters — done in Wave 33)*
- [ ] **Scheduled report delivery** — ReportSchedule model, cron, email/Slack. *(Depends on SMTP setup)*

---

## P2 Features (Backlog)

- [ ] Monte Carlo forecasting — velocity-based sprint completion probability
- [ ] Cycle time scatter / control chart — percentile overlay lines
- [ ] Query language (TQL) — PEG parser → FilterGroup
- [ ] Approval workflows — Approval model, workflow transition triggers
- [ ] Scheduled automation triggers — cron on AutomationRule
- [ ] Workload heatmap — assignee × week calendar grid
- [ ] Cross-project initiatives — Initiative model + portfolio tracking
- [ ] Auto-tracking from status transitions — TimeEntry with autoTracked
- [ ] Timesheet view — weekly grid
- [ ] Workflow-based permissions — allowedRoles on WorkflowTransition
- [ ] Field-level edit restrictions — FieldPermission per project

---

## Completed Waves (Summary)

| Wave | Date | Focus |
|------|------|-------|
| 28 | 2026-03-18 | Codebase cleanup (dead code, decomposition, hooks) |
| 29 | 2026-03-18 | Dependency graph, cycle time metrics, useFormState |
| 30 | 2026-03-18 | Server-side filtering, workflow transitions, kanban swimlanes |
| 31 | 2026-03-19 | Task watchers, WIP limits, release model |
| 32 | 2026-03-20 | Cumulative flow, time tracking, saved views |
| 33 | 2026-03-20 | Multi-level hierarchy, user capacity, compound filters |
| 34 | 2026-03-20 | Query centralization, ARIA/TaskDetail tabs, permission scheme |
| 35 | 2026-03-20 | Critical security fixes (C-1 through C-5, H-5/H-7/H-8/H-11) |
| 36 | 2026-03-20 | Auto-Complete Redesign — Foundation: KB schema, retrieval, autoComplete flag |
| 37 | 2026-03-20 | Auto-Complete Redesign — Foundation: KB panel, onboarding interview, pipeline wiring |

Full wave details in `changelog.md`.
