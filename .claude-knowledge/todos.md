# TaskToad — Remaining Work & Tracking

Production deployed at `https://tasktoad-api-production.up.railway.app`. 55 swarm waves completed. Security: 38/39 (97%). V1 feature cuts applied. All must-fix + should-fix UX issues resolved. SSE real-time working. 335 tests.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

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

## Manual Testing — Re-test Items

Items that were fixed but need verification on production:

- [ ] Epics hierarchy — expand/collapse, breadcrumbs, progress bars (GraphQL fix Wave 54, breadcrumbs verified Wave 55)
- [ ] Saved views — reload saved view restores filters (fix Wave 53)
- [ ] Shared Views section visible when shared views exist (fix Wave 55)
- [ ] TQL saved queries — save/reload/rename/delete (discoverability fix Wave 55)
- [ ] Workflow allowedRoles enforcement (set transition to admin-only, non-admin gets error)
- [ ] Field-level restrictions (set priority to admin-only, non-admin change skipped with warning)
- [ ] Charts & Analytics (needs sprint data — velocity, burndown, scatter, Monte Carlo, heatmap, portfolio)
- [ ] Release burndown chart (needs release with completed tasks)
- [ ] Concurrent session limit (6th login prunes oldest)
- [ ] Two tabs edit same task — no data loss

---

## Manual Testing Notes (Round 1, 2026-03-22)

### UX Issues (defer to post-V1)
- Sprint columns should be reorderable
- Close sprint should offer "create new sprint" option
- Release detail panel too small — should be full-page view
- Release notes should have manual entry option
- Time entry deletion should be admin-only action
- Time log entries not editable (can delete and re-add)
- Mobile: horizontal scrolling messy on project page
- Automation comments should not be attributed to a user (use system/bot)
- Automation rule library + cross-project sharing (feature request)

### UX Observations (informational — discuss before acting)
- Onboarding wizard questions too advanced for new users — discuss approach
- Project settings could use a guided tour or overview — lots of options
- Sprint task dropdown shows archived sprints
- Default project member permissions: empty members list means everyone has admin access — is this intended?

---

## V1 Feature Cuts (UI hidden, backend intact)

Features hidden from V1 UI. Backend code remains — re-enable by restoring UI entry points. See `apps/web/V1_FEATURE_CUTS.md` for details.

- **Initiatives** (cross-project grouping) — Portfolio page section removed
- **SLA Tracking** — badge + settings tab removed
- **Approval Workflows** — badge, buttons, history, PendingApprovalsPanel removed
- **Scheduled Automations** (cron triggers) — trigger type + cron UI removed
- **BacklogView keyboard navigation** — onKeyDown + ARIA removed

---

## Post-V1 Backlog

### Code Quality
- [ ] Refactor: extract shared action-completion orchestration from actionExecutor.ts and monitorCIPoll.ts
- [ ] useAsyncData: ReleaseListPanel still uses inline fetch pattern
- [ ] merge-worker.sh: auto-detect lockfile changes and run pnpm install before validation
- [ ] TQL value autocomplete for dynamic fields (assignee, label) — fetch project-specific values
- [ ] Automation rule edit: add test coverage for edit/save flow
- [ ] @mention tab-to-select: MentionAutocomplete keyboard navigation for dropdown
- [ ] @mention notification tests: unit tests for displayName-based mention parsing
- [ ] Priority dropdown: color coding (red for critical, orange for high)
- [ ] Dependency task picker: keyboard navigation for search results
- [ ] L-12: Test database credentials in CI/CD

### Feature Requests
- [ ] Scheduled report delivery — ReportSchedule model, cron, email/Slack *(depends on SMTP)*
- Re-enable V1 cuts when ready (initiatives, SLA, approvals, cron automation)

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
| 46 | 2026-03-21 | Code quality, unit tests (3 suites), P2 (Monte Carlo forecasting, cron automation) |
| 47 | 2026-03-21 | P2 (cycle time scatter, release burndown, auto-tracking, workload heatmap), polish batch |
| 48 | 2026-03-21 | P2 (timesheet view, approval workflows), follow-up polish |
| 49 | 2026-03-21 | P2 (initiatives, workflow permissions, field-level restrictions), polish |
| 50 | 2026-03-21 | TQL parser, follow-up fixes (field permissions, initiative, approval, timesheet) |
| 51 | 2026-03-21 | Feature polish, reliability, shared types, orchestrator metrics |
| 52 | 2026-03-22 | Final cleanup: SLA business hours, reliability, test stability |
| 53 | 2026-03-22 | Bug fixes: PWA offline page, V1 feature cuts, archived tasks, @mention, saved views, automation |
| 54 | 2026-03-22 | Must-fix UX: priority dropdown, AI permissions, dependency direction, epics GraphQL |
| 55 | 2026-03-22 | Should-fix UX: centered modal, auto-track clarity, TQL values, automation editing, SSE, saved views, epics |

Full wave details in `changelog.md`.
