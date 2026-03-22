# TaskToad — Remaining Work & Tracking

Production deployed at `https://tasktoad-api-production.up.railway.app`. 55 swarm waves completed. Security: 38/39 (97%). V1 feature cuts applied. All must-fix + should-fix UX issues resolved. SSE real-time working. 335 tests.

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

Note: Tests 12-14 (SLA, Approvals, Initiatives) are V1 cuts — UI hidden, skip these. Test 9 (Charts) needs sprint data to validate. Test 15 (KB) deferred to round 2.

### Test 1: Onboarding & Auth
- [x] Sign up with real email — graceful without SMTP
- [x] Sign up, log in, create an org
- [x] Set Anthropic API key in org settings
- [ ] Verify email → auto-login *(requires SMTP)*
- [x] Log out → log back in *(fixed Wave 53)*
- [ ] Concurrent session limit (6th login prunes oldest) *(not tested)*
- [x] Session expiry handling *(fixed Wave 53 — offline page → login redirect)*
- [x] Page refresh stays on page *(fixed post-Wave 53)*

### Test 2: Project Creation
- [x] Create project manually
- [x] AI project generation — 3 options, preview plan, commit
- [x] Tasks appear in Backlog
- [x] Onboarding wizard keyboard nav

### Test 3: Task Lifecycle
- [x] Create task, edit fields *(priority dropdown added Wave 54)*
- [x] Assign, due date, story points
- [x] Board status↔column sync
- [x] @mention in comments *(notification fix Wave 53)*
- [x] Add/remove label
- [x] Archive task *(filter fix Wave 53)*

### Test 4: Sprint Workflow
- [x] Create sprint with columns + WIP limits
- [x] Drag tasks from backlog
- [x] Activate sprint
- [x] WIP limit warnings
- [x] Close sprint

### Test 5: Hierarchy & Epics
- [ ] EpicsView tree — expand/collapse *(GraphQL fix Wave 54, needs re-test)*
- [ ] Click nested task — breadcrumbs
- [ ] Progress bars aggregate up hierarchy

### Test 6: Time Tracking & Timesheet
- [x] Log time, accumulates, estimated display, delete
- [x] Auto-tracked entry on status transition
- [ ] Edit time log entries *(no edit UI — UX issue)*
- [x] Timesheet grid, cell editing, keyboard nav, week nav, user filter

### Test 7: Saved Views, Filters & TQL
- [x] Apply filters, save view
- [ ] Reload saved view *(fix Wave 53, needs re-test)*
- [ ] Shared Views section *(needs re-test)*
- [x] Advanced filter builder
- [x] TQL filtering, autocomplete, help tooltip
- [ ] TQL saved queries *(save button not discoverable)*

### Test 8: Permissions & Access Control
- [x] Role change viewer/editor
- [x] Task fields disabled for viewers *(AI buttons fixed Wave 54)*
- [ ] Workflow allowedRoles enforcement *(needs re-test)*
- [ ] Field-level restrictions *(can re-test now with priority dropdown)*

### Test 9: Charts & Analytics *(needs sprint data)*
- [ ] Velocity, burndown, cumulative flow
- [ ] Cycle time scatter + control chart
- [ ] Monte Carlo forecast (≥3 closed sprints)
- [ ] Workload heatmap
- [ ] Portfolio rollup

### Test 10: Releases
- [x] Create, add tasks, generate notes, change status
- [ ] Release burndown chart *(needs data)*

### Test 11: Automation Rules
- [x] Simple rule, trigger executes
- [x] Multi-action + compound conditions *(fixed Wave 53)*
- [x] Automation rule editing *(fixed Wave 55)*

### Test 16: Responsive & Edge Cases
- [x] Mobile viewport, long text, rapid switching
- [ ] Two tabs edit same task *(not tested)*
- [x] Logout → /app redirects to login *(fixed Wave 53)*

### Test 17: Real-Time (SSE)
- [x] Task creation propagates across tabs *(SSE listeners added Wave 55)*
- [x] Status change propagates *(SSE listeners added Wave 55)*

---

## Manual Testing Notes (Round 1, 2026-03-22)

Organized feedback from first round of manual testing. Bugs are tracked above; these are UX observations and feature requests.

### UX Issues (should fix for V1)
- ~~Review plan modal is left-aligned instead of centered~~ *(fixed Wave 55)*
- ~~Auto-tracked time entry source unclear~~ *(fixed Wave 55 — description now shows duration, tooltip explains auto-tracking)*
- ~~TQL value autocomplete needed~~ *(fixed Wave 55 — status, priority, taskType values shown after colon)*
- ~~Automation rules can't be edited after creation~~ *(fixed Wave 55)*

### UX Issues (defer to post-V1)
- ~~5-step AI generation progress indicator feels arbitrary~~ *(simplified to spinner + status text in Wave 55)*
- Sprint columns should be reorderable
- Close sprint should offer "create new sprint" option
- Release detail panel too small — should be full-page view
- Release notes should have manual entry option
- Time entry deletion should be admin-only action
- ~~TQL saved query save button not discoverable~~ *(fixed Wave 55 — bookmark icon, updated placeholder text)*
- Mobile: horizontal scrolling messy on project page
- Automation comments should not be attributed to a user (use system/bot)
- Automation rule library + cross-project sharing (feature request)

### UX Observations (informational)
- Onboarding wizard questions too advanced for new users — discuss approach
- "blur to save" in timesheet was confusing (means clicking outside the cell saves it)
- Project settings could use a guided tour or overview — lots of options
- Sprint task dropdown shows archived sprints
- Default project member permissions: empty members list means everyone has admin access — is this intended?

---

## Security — Remaining (1 of 39)

- [ ] **L-12:** Test database credentials in CI/CD

Full report: `.claude-knowledge/security-audit.md`

---

## Deferred Polish

### Code Quality
- [x] SLA: weekends/business hours exclusion *(Wave 52)*

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
- [x] Swarm planning: Prisma model conflict guidance added to task-swarm SKILL.md *(Wave 52)*
- [ ] Refactor: extract shared action-completion orchestration from actionExecutor.ts and monitorCIPoll.ts
- [ ] useAsyncData: ReleaseListPanel still uses inline fetch pattern
- [ ] merge-worker.sh: auto-detect lockfile changes and run pnpm install before validation

### Wave 55 Follow-ups
- [ ] TQL value autocomplete for dynamic fields (assignee, label) — currently only static enums supported; could fetch project-specific values
- [ ] Shared views: still need to verify the `savedFilters` resolver returns shared views from other org members (Wave 55 only improved SSE/discoverability, not the resolver)
- [ ] Epics breadcrumbs and progress bars: task-003 didn't touch these — still needs manual re-test to confirm they work after Wave 54 GraphQL fix
- [ ] Automation rule edit: add test coverage for the new edit/save flow in AutomationTab

### Wave 54 Follow-ups
- [ ] Re-test field-level restrictions for priority now that the priority dropdown is editable (Test 8 line 144-145 — user couldn't validate before)
- [ ] EpicsView: re-test full hierarchy (Test 5) — expand/collapse, breadcrumbs, progress bars — now that GraphQL errors are fixed
- [ ] Priority dropdown: consider adding color coding (red for critical, orange for high) to match the old badge styling
- [ ] Dependency UX: add keyboard navigation for the dependency task picker search results

### Wave 53 Follow-ups
- [ ] @mention tab-to-select: MentionAutocomplete should support Tab/ArrowDown to select from dropdown (user noted in Test 3)
- [ ] @mention notification tests: add unit tests for displayName-based mention parsing in createComment
- [ ] Automation add_label: add logging when labelId is provided but lookup returns no match (currently just returns silently after Wave 53 fix — verify warn log is sufficient)
- [ ] Saved views: verify "Shared Views" section renders when shared views exist (user reported not seeing it in Test 7)
- [ ] SessionExpiredModal: manually verify modal appears correctly now that SW denylist is fixed (user reported offline page instead of modal in Test 1)
- [ ] Service worker: after deploying PWA fix, verify existing users' stale SWs get updated (registration.update() in main.tsx)

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
- [x] Fix flaky integration tests — expanded cleanDatabase table list + retry logic *(Wave 52)*
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
| 52 | 2026-03-22 | Final cleanup: SLA business hours, useAsyncData remaining, TQL keyboard nav + saved query CRUD, monitor_ci restart resilience, cancelActionPlan interrupt, flaky test fixes, swarm Prisma conflict guidance |
| 53 | 2026-03-22 | Bug fixes from manual testing: PWA offline page fix, V1 feature cuts (initiatives/SLA/approvals/cron/BacklogView keyboard), archived tasks, @mention notifications, saved views, automation add_label + compound conditions |
| 54 | 2026-03-22 | Must-fix UX: priority dropdown, AI button EDIT_TASKS permission, dependency direction clarity, epics view GraphQL fix |
| 55 | 2026-03-22 | Should-fix UX: centered modal, auto-track clarity, TQL value autocomplete, automation rule editing, SSE real-time fix, saved views shared section, TQL save discoverability, epics breadcrumbs verified |

Full wave details in `changelog.md`.
