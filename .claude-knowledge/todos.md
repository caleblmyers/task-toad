# TaskToad — Remaining Work & Tracking

Production deployed at `https://tasktoad-api-production.up.railway.app`. 54 swarm waves completed. Security: 38/39 (97%). V1 feature cuts applied. Auth/session + must-fix UX bugs resolved. Manual testing round 1 complete. 335 tests.

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

### Test 1: Onboarding & Auth
- [x] Sign up with real email — verify error is graceful if SMTP not configured (no crash)
- [x] Sign up, log in, create an org
- [x] Set Anthropic API key in org settings — verify it saves, hint shows last 4 chars
- [ ] Verify email → auto-login (cookies set, redirect to /app without separate login)
- [ ] Log out → log back in → session works (cookies, not localStorage)
-- when i logged out it sent me to the offline page and the try again button stayed there. i had to manually remove /login from the url to be sent back to login screen
- [ ] Open 6th browser/device login → oldest session should be pruned (concurrent session limit)
-- im not sure what this is asking
- [ ] Let session expire (wait 15 min or clear tt-access cookie) → SessionExpiredModal appears (not hard redirect)
-- i manually removed the tt-access cookie, when i refreshed the page it sent me to the offline page like what happened when logging out.
-- after working for what i think was 15 minutes i did end up getting logged out, and sent to this offline screen again.
-- yes after working some more it definitely seems like im just being logged out and have to log back in
-- also it seems like manually refreshing the page sends me to this offline page

### Test 2: Project Creation
- [x] Create a project manually (name + description)
- [x] "Generate Project Options" with AI — returns 3 options, pick one, preview task plan, commit
-- "review plan" modal is left aligned instead of center screen
-- the 5 steps seem arbitrary, if they dont actually mean anything they shouldnt be there
- [x] Tasks appear in Backlog tab with correct statuses
- [x] Onboarding wizard opens after project creation — Enter/Escape keyboard nav works
-- this feature needs reviewing. if someone is starting out they probably dont know or have preferences for a lot of the questions i was given. and im not sure if skipping an item removes it or defers to ai recommendation. also it seems like a good time for users to upload any relevant documents for their project

### Test 3: Task Lifecycle
- [x] Create task manually, edit title/description/priority/status
-- adding dependecies is confusing, not sure if im saying this blocks or is blocked by the other item
-- i didnt see where to assign priority
- [x] Assign yourself, add due date, add story points
- [x] Change status on Board tab (drag or dropdown) — verify status↔column sync
- [ ] Add comment with @mention — notification appears
-- i see the mention menu but i dont think i got a notification.
-- also it would be nice to have tab select type features for this menu
- [x] Add/remove label
- [ ] Archive task, verify hidden, toggle "show archived" to see it
-- i still see it when show archived is not toggled. maybe because im assigned? not sure why else
- [ ] BacklogView keyboard navigation — Arrow keys move between tasks, Enter/Space opens detail
-- i dont think this works but i dont think i even want it, at least not for v1

### Test 4: Sprint Workflow
- [x] Create sprint with custom columns and WIP limits
-- i should be able to reorder columns
- [x] Drag tasks from backlog into sprint
- [x] Activate sprint — Board tab shows it
- [x] Move tasks between columns — WIP limit warnings appear (red/amber)
- [x] Close sprint — test "move incomplete tasks" options
-- should have option to create new sprint to move them into if none exist, and also transition to another active sprint after closing

### Test 5: Hierarchy
-- i dont think any of this feature is working. i see where i can select an epic at the top of task detail if a task already has one, but i dont see a list of them, and i dont see an option to make something epics or initiatives. also i dont think the idea of an "initiative" is needed. did i ever ask for that? when was that decided to include?
-- after working more i see the initiatives section with a create initiative option on the dashboard, i also see the epics view per projects with the epics listed, but i see graphql errors when selecting them. i will not be testing these features until i finish the first round and review with you.
- [ ] Create initiative → epic → story → task chain
-- dropdown to assign tasks to a sprint shows archived
- [ ] EpicsView tree renders with expand/collapse
- [ ] Click nested task — breadcrumbs show full chain
- [ ] Progress bars aggregate correctly up hierarchy

### Test 6: Time Tracking & Timesheet
- [x] Open task, log time (30 min, today)
- [x] Log more time — total accumulates
- [x] "Logged vs estimated" display when task has estimated hours
- [x] Delete a time entry
-- im not sure if this adds value, but should be an admin action if so
- [x] Move task from in_progress → done — auto-tracked entry appears with "Auto" badge
-- what is this time from the auto entry?
- [ ] Auto-tracked entry is editable (can adjust duration)
-- i dont see an option to edit time logs
- [x] Timesheet tab — weekly grid renders with task rows × day columns
- [x] Click cell to edit hours, blur to save
-- seemed to save automatically, not sure what "blur to save" means
- [x] Set cell to 0 — entry is deleted (not kept as 0)
- [x] Keyboard nav: Tab/Arrow keys move between cells, Enter saves + moves down, Escape cancels
- [x] Week navigation (prev/next) loads correct week
- [x] User filter dropdown shows display names (not emails)

### Test 7: Saved Views, Filters & TQL
- [x] Apply filters (status + priority), save as view
- [ ] Clear filters, reload saved view — restores correctly
-- it doesnt seem like im able to apply saved views, or click them from the filter menu, and if i have filters applied trying to select a view clears filters
- [ ] Share view — appears under "Shared Views"
-- i was able to select to share view, but i dont see the "shared views" area
- [x] Advanced filter builder — create OR group, apply, verify results
- [x] TQL: type `status:done priority:high` in search bar — tasks filter correctly
-- this works, it would be nice if for multi word options i could write "status:in progress" instead of "status:in_progress", but im not sure if its possible without the underscore.
- [x] TQL autocomplete: type `sta` → dropdown shows `status`, arrow keys + Enter to select
- [x] TQL help tooltip: click ? icon next to search bar — syntax reference shows
- [ ] TQL saved queries: save a query, reload it, rename it, delete it
-- i dont know how to save the query

### Test 8: Permissions & Access Control
- [x] In Members tab, change role to "viewer" on a project
-- first off the project settings members is empty at first, does this give everyone on the team admin access by default? i am testing with both an admin and a member on the same test org, and it seems like the member can view everything from the project already
- [x] Verify task fields disabled in TaskDetailPanel (can't edit when lacking EDIT_TASKS)
-- it seems like most direct task fields were correctly disabled, but i was able to select the "generate implementation spec". these buttons and ai features should be disabled with the same permissions as other task editing.
- [x] Change role to "editor" — can edit again
- [ ] Workflow permissions: set a transition's allowedRoles to ["admin"] — non-admin gets ForbiddenError
-- im not sure what this is asking. i was able to change the member user to an admin in the project settings and i did not get an error.
- [ ] Field-level restrictions: set "priority" to admin-only — non-admin's priority change is silently skipped with warning
-- i was able to edit the field-level restrictions but as mentioned earlier i dont know how to manually edit priority so im not sure how to validate.
-- the project settings as a whole could use review, im not very familiar with what all is available there.

### Test 9: Charts & Analytics
-- im not sure how to work with a lot of what is asked here. i see a basic dashboard, but it may be limited since i dont have much active data on the test account. i would like to review this section after initial testing phase.
- [ ] Dashboard tab — velocity, burndown, cumulative flow charts render
- [ ] Cycle Time panel — date range presets work
- [ ] Cycle time scatter chart — dots render, percentile lines visible, hover shows task info
- [ ] Control chart mode — rolling average line + std dev bands render, window size dropdown works
- [ ] Monte Carlo forecast panel — probability gauge + percentile table (only with >= 3 closed sprints)
- [ ] Workload heatmap — user×week grid with color-coded cells, date range inputs work
- [ ] Portfolio page — rollup stat cards show aggregate data

### Test 10: Releases
- [x] Create release (name + version)
- [x] Add tasks to release
-- the release detail currently displays in a small sidebar like the task details, but it seems like it would be better off with more off a full page view
- [x] Generate release notes (requires Anthropic key)
-- should be option for manual entry if not already
- [x] Change release status (draft → scheduled → released)
- [ ] Release burndown chart — shows total vs remaining tasks over time
-- i dont have active data so im not sure how valid this is. i see a chart but it is empty

### Test 11: Automation Rules
- [x] Create a simple rule: on status_changed to "done" → set_status "archived"
-- there should be a library to create these individually and/or move between projects.
-- also should be able to edit rules.
-- comments and other activity from automation rules should not be attributed to a user
- [x] Trigger the rule — verify action executes
- [ ] Create multi-action rule: status_changed → add_label + add_comment — both actions execute
-- it added the comment but i dont think the label was working
- [ ] Compound condition: AND(status=done, priority=high) — verify only matching tasks trigger
-- status = in_review and priority = critical did not seem to work.
- [ ] Scheduled trigger: set cron "Every hour" — verify cronExpression saved, nextRunAt set
-- im not sure if i want to include this in v1
- [ ] New action types: send_webhook (verify URL validation), set_due_date (verify date set)
-- i dont know what this is asking me

### Test 12: SLA Tracking
-- im not sure how SLAs work, i will review this and come back after first round of testing
- [ ] Create SLA policy (name, response 4h, resolution 24h, priority filter)
- [ ] Create a task matching the policy — SLA timer starts
- [ ] Move task to in_progress — verify timer tracking
- [ ] SLA status badge in task detail — green (within target), amber (nearing), red (breached)
- [ ] Move task back to todo — timer pauses (paused time excluded)
- [ ] Business hours: verify non-business hours/weekends are excluded from timer

### Test 13: Approval Workflows
-- i created a workflow transition rule from in review to done, allowed editor and admin, required approval from my admin account, and instead of only blocking in review to done transitions, it blocked my member account from moving a task from todo to in progress. this is another feature i will review and come back to after first round of testing
- [ ] Configure a workflow transition with requiresApproval: true
- [ ] Attempt the transition — task stays, "Pending approval" badge appears
- [ ] SSE toast notification: "Approval requested" appears for approvers
- [ ] Approve the transition — task status changes, approval history shows "approved"
- [ ] Reject a different transition — task stays, history shows "rejected" with comment
- [ ] Configurable approvers: set specific users on transition, verify only they can approve
- [ ] Approval history in task detail — shows all past approvals with comments

### Test 14: Initiatives & Portfolio
-- this is another feature i will come back to after first round of testing
- [ ] Create initiative (name, description, target date)
- [ ] Add projects to initiative — portfolio filters to show only linked projects
- [ ] Initiative card shows aggregate stats (completion %, health score, project count)
- [ ] Edit initiative (change name, status, target date)
- [ ] Delete initiative — projects unlinked, not deleted
- [ ] Create/edit initiative modals work in dark mode

### Test 15: Knowledge Base
-- this is another feature i will come back to after first round of testing
- [ ] Add KB entry manually (title, content, category)
- [ ] Search/filter KB entries — matches by title and content
- [ ] Upload .md file — content imported
- [ ] "Refresh from repo" (GitHub-connected project) — creates KnowledgeEntry with source='learned'
- [ ] Migration banner (if legacy knowledgeBase text exists) — one-click migrate

### Test 16: Responsive & Edge Cases
- [x] Phone-width viewport — sidebar collapses, navigation works
-- sidebar collapses and navigation works. horizontal scrolling is a bit of a mess on the project page
- [x] Very long task title/description — layout doesn't break
-- seems to be wrapping or making ellipses as needed
- [x] Rapid task switching — no stale data or race conditions
- [ ] Two tabs, edit same task — no data loss
-- im not sure good ways to test this properly. one thing i did was moving the same task to in progress on two accounts, the second account was the one assigned where i guess they should have been blocked since the first person already assigned themselves?
- [ ] Log out → access /app — redirects to login
-- i mentioned logout issues above

### Test 17: Real-Time (SSE)
- [x] Two browser tabs on same project
- [ ] Create task in tab 1 — appears in tab 2 without refresh
-- i was viewing the backlog for the same project on two accounts. i created a task on account 1, but account 2 did not see it right away. i switched to board view then back on account 2 and it did appear. is this correct behavior, or was it supposed to appear without needing to change views like that?
- [ ] Change task status in tab 1 — tab 2 updates
-- account 2 did not see the task status update after switching between board and backlog, nor when leaving the project and coming back
- [ ] Approval requested — toast notification appears in other tab
-- im not sure how to test this
- [ ] Action plan completes — execution dashboard updates in real-time
-- im not sure how to test this

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

Full wave details in `changelog.md`.
