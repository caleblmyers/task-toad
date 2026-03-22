# TaskToad — Remaining Work & Tracking

Production deployed at `https://tasktoad-api-production.up.railway.app`. 51 swarm waves completed. Security: 38/39 (97%). All P1 + P2 features complete. Zero lint warnings. 335 tests.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Priority Order

1. Manual testing (12 test groups below) — find real bugs
2. Remaining ops (Sentry, UptimeRobot, SMTP, Railway health check)
3. Remaining security (L-5, L-12)
4. Remaining P1 features (automation, scheduled reports, SLA)
5. P2 features — only after everything above is solid

---

## Deployment & Ops

### Infrastructure
- [ ] Railway health check in service settings (auto-restart on failure)
- [ ] Custom domain (optional — Railway domain works for beta)
- [ ] Run data migration scripts in production (`migrate-encrypt-secrets.ts`, `migrate-hash-invite-tokens.ts`)

### Observability
- [ ] Verify Sentry receives errors in production
- [ ] UptimeRobot monitor: HTTP check on `/api/health` every 5 min
- [ ] Sentry integration for web frontend ErrorBoundary (currently suppresses console.error in prod)

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

## Security — Remaining (1 of 39)

- [ ] **L-12:** Test database credentials in CI/CD

Full report: `.claude-knowledge/security-audit.md`

---

## Deferred Polish

### Code Quality
- [x] Add integration tests for `previewHierarchicalPlan` and `commitHierarchicalPlan` resolvers *(Wave 51)*
- [x] SLA: paused time handling (task reopened) *(Wave 51)*
- [ ] SLA: weekends/business hours exclusion from SLA timer

### Features
- [x] KB entry search/filter in KnowledgeBasePanel *(Wave 51)*
- [x] PlanDependencyEditor: subtask-level dependencies *(Wave 51)*
- [x] ExecutionDashboard: dependency visualization between plans *(Wave 51)*
- [x] ExecutionDashboard: stat cards use unfiltered counts *(Wave 51)*
- [x] Orchestrator: Prometheus metrics *(Wave 51)*
- [x] Shared-types expansion — Report type in `@tasktoad/shared-types` *(Wave 51)*
- [x] S3 multipart upload for files >10MB *(Wave 51)*
- [x] useAsyncData adoption (3 components migrated) *(Wave 51)*
- [x] useAsyncData adoption — migrate remaining inline fetch-in-useEffect components *(Wave 52 — 5 more: Portfolio, PendingApprovals, SprintForecast, Timesheet, WorkloadHeatmap)*
- [ ] useAsyncData adoption — ReleaseListPanel still uses inline fetch pattern
- [x] TQL autocomplete — keyboard navigation (arrow keys + Enter to select) *(Wave 52)*
- [x] TQL saved queries — delete/rename saved queries *(Wave 52)*

### Reliability
- [x] monitor_ci: make polling resilient to process restarts *(Wave 52)*
- [x] cancelActionPlan: verify it interrupts actively executing actions *(Wave 52)*
- [ ] Refactor: extract shared action-completion orchestration (next-action chaining, plan completion events) from actionExecutor.ts and monitorCIPoll.ts into a shared helper
- [x] Planning prompt: validate monitor_ci/fix_ci source action IDs *(Wave 51)*
- [x] AI rate limiter: in-memory sliding window cache *(Wave 51)*
- [x] Anthropic SDK: app-level retry with exponential backoff *(Wave 51)*
- [x] Email redaction default for non-admin exports *(Wave 51)*

### Tooling
- [ ] Swarm planning: when two tasks add Prisma models, they conflict in shared import files — note dependency or have workers rebase

---

## Remaining P1 Features (Deferred)

- [ ] **Scheduled report delivery** — ReportSchedule model, cron, email/Slack. *(Depends on SMTP setup)*

---

## P2 Features (Backlog)

- [x] Monte Carlo forecasting — velocity-based sprint completion probability *(Wave 46)*
- [x] Cycle time scatter / control chart — percentile overlay lines *(Wave 47)*
- [x] Query language (TQL) — recursive descent parser → FilterGroup *(Wave 50)*
- [x] Approval workflows — Approval model, workflow transition triggers *(Wave 48)*
- [x] Scheduled automation triggers — cron on AutomationRule *(Wave 46)*
- [x] Workload heatmap — assignee × week calendar grid *(Wave 47)*
- [x] Cross-project initiatives — Initiative model + portfolio tracking *(Wave 49)*
- [x] Auto-tracking from status transitions — TimeEntry with autoTracked *(Wave 47)*
- [x] Timesheet view — weekly grid *(Wave 48)*
- [x] Workflow-based permissions — allowedRoles on WorkflowTransition *(Wave 49)*
- [x] Field-level edit restrictions — FieldPermission per project *(Wave 49)*
- [x] Release burndown — tests for releaseBurndown resolver (edge cases: no tasks, all done, release with no activities) *(Wave 48)*
- [x] Cycle time scatter — control chart mode (rolling average line, standard deviation bands) *(Wave 48)*
- [x] Workload heatmap — use display name instead of email prefix for userName *(Wave 48)*
- [x] Auto-tracking — handle re-assignment during in_progress (multi-assignee split) *(Wave 48)*
- [x] Auto-tracking — tests for timeTrackingListener (mock event bus + prisma) *(Wave 48)*
- [x] Timesheet — delete time entry when setting hours to 0 *(Wave 49)*
- [x] Timesheet — keyboard navigation between cells (Tab/arrow keys) *(Wave 49)*
- [x] Timesheet — show display names in user filter dropdown *(Wave 50)*
- [x] Approval workflows — SSE notification when approval is requested *(Wave 49)*
- [x] Approval workflows — approval history/audit log in task detail *(Wave 50)*
- [x] Approval workflows — configurable approvers per transition *(Wave 50)*
- [x] Control chart — configurable rolling window size *(Wave 49)*
- [x] Initiative — update/edit modal *(Wave 50)*
- [x] Initiative — DataLoader for initiative summary queries *(Wave 50)*
- [x] Initiative — dark mode support for Create/EditInitiativeModal *(Wave 50)*
- [x] Field permissions — add `estimatedHours` and `priority` to fieldArgMapping *(Wave 50)*
- [x] Field permissions — DataLoader for fieldPermission lookups in updateTask *(Wave 50)*
- [x] Approval SSE — include approver info in approval.decided event *(Wave 50)*
- [x] Timesheet keyboard nav — arrow keys navigate without saving *(Wave 50)*
- [ ] Fix flaky integration tests — FK violations, deadlocks, unique constraints in e2e/notification/security/sprint tests
- [x] TQL — autocomplete/suggestions dropdown for field names as user types *(Wave 51)*
- [x] TQL — saved TQL queries (bookmark common searches) *(Wave 51)*
- [x] TQL — detection regex extracted to shared tqlHelpers.ts *(Wave 51)*
- [x] Approval history — show requester's comment in approval history *(Wave 51)*
- [x] Approval workflows — email notification to designated approvers *(Wave 51)*

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
| 42 | 2026-03-21 | Security Phase 2 — Auth Hardening (all 8 High items) |
| 43 | 2026-03-21 | Security Phase 3+4 — 9 Medium + 6 Low fixes |
| 44 | 2026-03-21 | Security cleanup, integration tests, auth follow-ups, frontend polish |
| 45 | 2026-03-21 | P1 features (SLA, multi-action automation, compound conditions), L-5 session limit, backend+frontend polish |
| 46 | 2026-03-21 | Code quality (SLA perms, prisma casts, Sentry web, 0 lint warnings), unit tests (3 suites), P2 (Monte Carlo forecasting, cron automation) |
| 47 | 2026-03-21 | P2 features (cycle time scatter, release burndown, auto-tracking, workload heatmap), polish batch (cron shutdown, SLA checker, Monte Carlo tests, forecast skeleton, Sentry guard) |
| 48 | 2026-03-21 | P2 features (timesheet view, approval workflows), follow-up polish (burndown tests, control chart, heatmap names, auto-tracking multi-assignee + tests) |
| 49 | 2026-03-21 | P2 features (cross-project initiatives, workflow permissions, field-level restrictions), polish (timesheet delete/keyboard nav, approval SSE, control chart window, merge script fix) |
| 50 | 2026-03-21 | TQL parser + frontend integration, follow-up fixes (field permissions, initiative edit/DataLoader, approval history, timesheet UX, configurable approvers, SSE approver info) |
| 51 | 2026-03-21 | Feature polish (KB search, ExecutionDashboard deps/stats, S3 multipart, useAsyncData, TQL autocomplete/saved queries), reliability (hierarchical plan tests, SLA pause, AI rate limiter cache, SDK retry, email redaction, prompt validation), shared types (Report), orchestrator metrics, approval email notifications |

Full wave details in `changelog.md`.
