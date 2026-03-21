# TaskToad — Remaining Work & Tracking

Production deployed at `https://tasktoad-api-production.up.railway.app`. 44 swarm waves completed. All P0 and most P1 competitive gap items done. All Critical, High, and Medium security findings fixed (37 of 39). Auto-Complete Pipeline Redesign complete (Waves 36-41). Security Phases 2-4 complete (Waves 42-44). 19 security integration tests added.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Priority Order

1. Manual testing (12 test groups below) — find real bugs
2. Security Phase 2 (High items) — auth hardening
3. Remaining ops (UptimeRobot, SMTP, Railway health check)
4. Security Phase 3-4 (Medium + Low)
5. Remaining P1 features (automation, scheduled reports, SLA)
6. P2 features — only after everything above is solid

---

## Deployment & Ops

### Infrastructure
- [ ] Railway health check in service settings (auto-restart on failure)
- [ ] Custom domain (optional — Railway domain works for beta)

### Observability
- [ ] Verify Sentry receives errors in production
- [ ] UptimeRobot monitor: HTTP check on `/api/health` every 5 min

### Email (optional for beta)
- [ ] SMTP provider configured (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
- [ ] Email verification and password reset flows tested

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
**Resolved (Wave 42):** H-1, H-2, H-3, H-4, H-6, H-9, H-10, H-12 — all 8 High items fixed. Also resolves L-1 (JWT expiry) and L-9 (SameSite cookie).
**Resolved (Wave 43):** M-1, M-2, M-3, M-5, M-6, M-7, M-8, M-9, M-10 (9 of 10 Medium), L-2, L-3, L-4, L-7, L-8, L-10 (6 Low).
**Resolved (Wave 44):** M-4, L-6, L-11. Only L-5 (session limit) and L-12 (CI credentials) remain.

### Phase 2 — High (Auth Hardening) ✅ Complete

- [x] **H-1: JWT in localStorage → HttpOnly cookies** — 15-min access + 7-day refresh tokens in HttpOnly/Secure/SameSite=Strict cookies.
- [x] **H-2: CSRF protection** — X-Requested-With header required on POST /graphql.
- [x] **H-3: Encrypt webhook secrets at rest** — AES-256-GCM via encryption.ts.
- [x] **H-4: Encrypt Slack webhook URLs at rest** — AES-256-GCM, masked in responses.
- [x] **H-6: Pagination caps on list queries** — Math.min(limit, 100) on all list resolvers.
- [x] **H-9: Hash invite tokens before storage** — SHA-256 hashToken() before DB storage.
- [x] **H-10: Fix $queryRawUnsafe in advisory locks** — $queryRaw tagged template literals.
- [x] **H-12: Re-authentication for sensitive operations** — confirmPassword on setOrgApiKey.

### Phase 3 — Medium

- [x] **M-1:** Disable GraphQL introspection in production *(Wave 43)*
- [x] **M-2:** Per-org AI rate limiting (60 AI requests/hour, configurable) *(Wave 43)*
- [x] **M-3:** Content-Disposition header injection — filename sanitization *(Wave 43)*
- [x] **M-4:** File upload magic byte validation (`file-type` library) *(Wave 44)*
- [x] **M-5:** Scope DataLoaders by orgId *(Wave 43)*
- [x] **M-6:** Audit logging for sensitive operations *(Wave 43)*
- [x] **M-7:** Redact emails in exports (opt-in via ?redactEmails=true) *(Wave 43)*
- [x] **M-8:** Saved filter mutations skip orgId validation *(Wave 43)*
- [x] **M-9:** Input length validation on text fields (title 200, description 10000) *(Wave 43)*
- [x] **M-10:** Webhook replay prevention (`X-Webhook-Delivery-ID`) *(Wave 43)*

### Phase 4 — Low

- [x] **L-1:** Reduce JWT expiry + refresh tokens *(resolved by H-1 in Wave 42)*
- [x] **L-2:** Email enumeration on signup *(Wave 43)*
- [x] **L-3:** URL-encode GitHub file paths *(Wave 43)*
- [x] **L-4:** Remove console.error in production ErrorBoundary → dev-only *(Wave 43)*
- [ ] **L-5:** Concurrent session limit *(depends on H-1)*
- [x] **L-6:** Unicode homograph in filenames *(Wave 44)*
- [x] **L-7:** Bulk mutation item count limit (cap 100) *(Wave 43)*
- [x] **L-8:** Reduce GraphQL depth limit (10 → 7) *(Wave 43)*
- [x] **L-9:** SameSite cookie attribute *(resolved by H-1 in Wave 42)*
- [x] **L-10:** Cap Retry-After parsing (max 1 hour) + disable SDK auto-retries *(Wave 43)*
- [x] **L-11:** Null byte stripping on REST endpoints *(Wave 44)*
- [ ] **L-12:** Test database credentials in CI/CD

---

## Auto-Complete Pipeline Follow-ups

Pipeline complete (Waves 36-41). These are deferred polish items:

### Code Quality
- [ ] Add integration tests for `previewHierarchicalPlan` and `commitHierarchicalPlan` resolvers
- [ ] Add unit tests for `batchDetectCycles` utility
- [ ] Add tests for insight generation hook in actionExecutor
- [ ] ManualTaskSpec resolver uses `(task as Record<string, unknown>).acceptanceCriteria` cast — DataLoader type should include acceptanceCriteria
- [ ] TaskInsight: add DataLoader for sourceTask/targetTask field resolvers (N+1)
- [ ] Insights tab count badge duplicates InsightPanel fetch — deduplicate with shared state or count-only query
- [ ] `setExpandedIds` in HierarchicalPlanEditor useEffect triggers `react-hooks/set-state-in-effect` warning

### Features
- [ ] "Refresh from repo" in KnowledgeBasePanel still writes to legacy `project.knowledgeBase` — update to create KnowledgeEntry
- [ ] Onboarding wizard keyboard navigation (Enter to advance, Escape to close)
- [ ] KB entry search/filter in KnowledgeBasePanel when entry count grows large
- [ ] PlanDependencyEditor: subtask-level dependencies not supported (only epics and tasks)
- [ ] ExecutionDashboard: dependency visualization between plans (blocked-by relationships)
- [ ] ExecutionDashboard: stat cards count from filtered list — use separate all-plans query
- [ ] Orchestrator: add metrics/observability (tasks auto-enqueued, failures, concurrency limit hits)

### Reliability
- [ ] monitor_ci: make polling resilient to process restarts (job queue re-enqueue vs in-process sleep)
- [ ] cancelActionPlan: verify it interrupts actively executing actions (currently only updates status)
- [ ] Planning prompt: validate monitor_ci/fix_ci source action IDs in schema

### Security Follow-ups (Waves 42-44)
- [x] Integration tests for per-org AI rate limiter *(Wave 44 — security.integration.test.ts)*
- [x] Integration tests for audit logging *(Wave 44)*
- [x] Integration test for email anti-enumeration *(Wave 44)*
- [x] Tests for export email redaction *(Wave 44)*
- [x] Tests for bulkUpdateTasks 100-item limit *(Wave 44)*
- [x] Integration tests for cookie-based auth flow *(Wave 44)*
- [x] Integration test for CSRF protection *(Wave 44)*
- [x] Data migration script for webhook secrets and Slack URLs *(Wave 44 — scripts/migrate-encrypt-secrets.ts)*
- [x] Data migration script for invite tokens *(Wave 44 — scripts/migrate-hash-invite-tokens.ts)*
- [x] Auto-refresh modal instead of hard redirect *(Wave 44 — SessionExpiredModal)*
- [x] verifyEmail sets HttpOnly cookies *(Wave 44)*
- [ ] L-5: Concurrent session limit — needs RefreshToken model design
- [ ] M-7 design choice: consider making email redaction default with admin opt-out
- [ ] Sentry integration for web frontend ErrorBoundary (currently suppresses console.error in prod)
- [ ] AI rate limiter: consider in-memory cache/sliding window for high-throughput orgs
- [ ] Anthropic SDK maxRetries=0 — consider app-level retry with capped backoff

### Tooling
- [ ] merge-worker.sh: fix script treating lint warnings (exit 0 with warnings) as failures
- [ ] Swarm task descriptions: when changing observable API behavior, explicitly call out "update existing tests that assert the old behavior" (Wave 43 issue)

---

## Remaining Polish

- [ ] Shared-types expansion — add Report type to `@tasktoad/shared-types`
- [ ] S3 multipart upload — current 10MB limit uses single PUT
- [ ] useAsyncData adoption — migrate components with inline fetch-in-useEffect
- [ ] Release burndown chart — task completion over time for releases
- [ ] Unit tests for `urlValidator.ts` — private IP ranges, DNS mocking, protocol/port blocking
- [x] Frontend: disable task field editing when user lacks EDIT_TASKS permission *(Wave 44)*
- [x] BacklogView keyboard navigation (Enter/Space to select task) *(Wave 44)*
- [ ] ~3 dynamic mutations remain inline in useTaskOperations.ts
- [x] SavedViewPicker lint warning: setState in useEffect *(Wave 44 — reduced warnings 5→3)*

---

## Remaining P1 Features (Deferred)

- [ ] **SLA tracking** — SLAPolicy + SLATimer models. Evaluate on status transitions.
- [ ] **Multi-action automation rules** — Change action field to array. New action types: send_webhook, add_label, add_comment, set_due_date.
- [ ] **Compound automation conditions** — Reuse FilterGroup from search.
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
| 36-41 | 2026-03-20 | Auto-Complete Pipeline Redesign (KB, planning, execution, insights, dashboard) |
| 42 | 2026-03-21 | Security Phase 2 — Auth Hardening (H-1/H-2/H-3/H-4/H-6/H-9/H-10/H-12) |
| 43 | 2026-03-21 | Security Phase 3+4 — Medium fixes (M-1/M-2/M-3/M-5-M-10) + Low fixes (L-2/L-3/L-4/L-7/L-8/L-10) |
| 44 | 2026-03-21 | Security cleanup (M-4/L-6/L-11), integration tests, auth follow-ups, frontend polish |

Full wave details in `changelog.md`.
