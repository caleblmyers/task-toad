# Remaining Work

All original work sets completed through Wave 30. Completed items are in `changelog.md`.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Wave 30 — Server-side Filtering + Workflow Transitions + Kanban Swimlanes — Completed (2026-03-18)

- [x] Server-side task filtering — backend (task-001, worker-1)
- [x] Server-side task filtering — frontend integration (task-002, worker-1)
- [x] Workflow transition model — backend + dependency warning surfacing (task-003, worker-2)
- [x] Workflow transition config UI + warning display (task-004, worker-2)
- [x] dependsOn data migration + OrgSettings lint fix (task-005, worker-3)
- [x] Kanban swimlanes — groupBy parameter (task-006, worker-3)

## Wave 29 — Dependency Graph + Metrics + Cleanup — Completed (2026-03-18)

- [x] Task dependency graph — backend model + GraphQL API (task-001, worker-1)
- [x] Task dependency graph — frontend + AI integration (task-002, worker-1)
- [x] Cycle time and lead time metrics query + frontend (task-003, worker-2)
- [x] Dead query cleanup + useFormState adoption in OrgSettings (task-004, worker-2)
- [x] useFormState adoption in SlackSettings + WebhookSettings (task-005, worker-3)
- [x] useFormState adoption in settings tabs + NotificationSettings (task-006, worker-3)

## Wave 28 — Codebase Cleanup — Completed (2026-03-18)

- [x] API dead code + promptBuilder decomposition (task-001, worker-1)
- [x] Decompose ai.ts resolver + fix type casts (task-002, worker-2)
- [x] Web dead code removal + useAIGeneration slim-down (task-003, worker-3)
- [x] Decompose ProjectSettingsModal into tab components (task-004, worker-3)
- [x] Decompose task.ts resolver (task-005, worker-1)
- [x] Decompose useTaskCRUD + useProjectData hooks (task-006, worker-3)
- [x] Add User orgId index + extract useFormState hook (task-007, worker-2)

---

## Remaining Cleanup

### Dead Code
- [x] Delete unused query constants from queries.ts (Wave 29, task-004)

### Duplication Reduction (large scope)
- [ ] Centralize inline GraphQL queries (65 queries across 24 files → `apps/web/src/api/queries.ts`). Worst offenders: settings tab components (post-Wave 28 split), `SlackSettings.tsx` (9), `WebhookSettings.tsx` (5)
- [x] Adopt `useFormState` hook in settings components (Wave 29, tasks 004-006)

### Lint Warnings
- [x] Fix lint warning in OrgSettings.tsx:136 (Wave 30, task-005)

### Remaining Polish
- [ ] Remaining ARIA audit — screen reader testing, focus management on modal open/close, skip nav landmark coverage
- [ ] Shared-types expansion — add Report type to `@tasktoad/shared-types`
- [ ] S3 multipart upload — current 10MB limit uses single PUT; implement multipart for larger files
- [ ] useAsyncData adoption — migrate other components with inline fetch-in-useEffect patterns
- [ ] Task detail re-architecture (UX Audit Item 10) — collapsible sections, tabbed comments/activity

### Beta Scope — Known Limitations (not planned)
- Project-level access control — org-level read access for beta. Project-level RBAC deferred to post-beta.
- Runner / autonomous execution — aspirational, never built. TaskToad is AI-assisted, not autonomous.

---

## Competitive Gap — P0 (Foundation)

These block scaling, process enforcement, and basic team adoption.

### Task Lifecycle & Workflow
- [x] **Workflow transition model** — WorkflowTransition model with CRUD, updateTask validation, backward-compatible (no rules = all moves). *(Wave 30, tasks 003-004)*
- [x] **Dependency graph** — TaskDependency join table with cycle detection + blocking validation. *(Wave 29)*
- [x] **Dependency blocking warning surfacing** — updateTask returns `UpdateTaskResult { task, warnings }`, frontend shows warning toasts. *(Wave 30, task-003)*
- [x] **Data migration: dependsOn → TaskDependency** — SQL migration + column drop + all references removed. *(Wave 30, task-005)*

### Search & Filtering
- [x] **Server-side task filtering** — TaskFilterInput with status/priority/assignee/labels/search/sort. Dynamic Prisma WHERE. Frontend debounced re-fetch. *(Wave 30, tasks 001-002)*

### Collaboration
- [x] **@mention notification routing** — Already implemented in `createComment` resolver (lines 267-285). Extracts @email mentions via regex, batch-looks up users, passes `mentionedUserIds` to notification listener. Stale todo — was done before Wave 28.

---

## Competitive Gap — P1 (Competitive Parity)

Expected by teams switching from Jira/Asana/Wrike.

### Task Lifecycle & Workflow
- [x] **Cycle time / lead time metrics** — Computed query over existing Activity table. Lead time = created→done. Cycle time = first in_progress→done. Aggregate per sprint/time window. No schema changes. *(Wave 29)*
- [ ] **Cycle time date range filter UI** — The `cycleTimeMetrics` query accepts `fromDate`/`toDate` params but the CycleTimePanel frontend doesn't expose date range pickers yet. Add date inputs to filter metrics by time window.
- [ ] **SLA tracking** — `SLAPolicy { projectId, name, targetMinutes, businessHoursCalendar?, pauseOnStatuses? }` and `SLATimer { taskId, policyId, startedAt, pausedMinutes, breachedAt? }`. Evaluate on status transitions.

### Planning & Estimation
- [ ] **User capacity model** — `UserCapacity { userId, weeklyHours }` and `UserTimeOff { userId, startDate, endDate }`. Sprint planning calculates available hours vs committed work. Feed into AI sprint planner as context.
- [ ] **Release model** — `Release { releaseId, projectId, name, targetDate, status, description }` + `releaseId` FK on Task. Release burndown, release notes generation (via existing AI report system).

### Views & Visualization
- [x] **Kanban swimlanes** — `groupBy` parameter on KanbanBoard (assignee, priority, epic). Collapsible swimlane headers, localStorage persistence. *(Wave 30, task-006)*
- [ ] **WIP limits** — `wipLimits` JSON field on Sprint. Visual warning on column header when exceeded. Optional hard enforcement on `updateTask`.
- [ ] **Cumulative flow diagram** — Daily status counts computed from Activity table. Stacked area chart (reuse existing Recharts setup from velocity/burndown charts).

### Search & Filtering
- [ ] **Compound filter expressions** — `FilterGroup { operator: AND|OR, conditions: [...] }` structure. Recursive Prisma clause translation. Shared with automation engine conditions.
- [ ] **Saved views** — Extend `SavedFilter` to include viewType, sortBy, groupBy, visibleColumns. Rename model to `SavedView`.

### Collaboration
- [ ] **Task watchers** — `TaskWatcher { taskId, userId }` join table. Auto-add on creation (creator), assignment, @mention. Notify all watchers on task updates. Watch/unwatch mutations.

### Automation
- [ ] **Multi-action automation rules** — Change `action` field from single JSON to array. Execute sequentially. Add action types: `send_webhook`, `add_label`, `add_comment`, `set_due_date`.
- [ ] **Compound automation conditions** — Reuse `FilterGroup` from search. Support operators: `>`, `<`, `contains`, `is_empty`, `changed_to`, `changed_from`.

### Reporting
- [ ] **Cross-project rollup metrics** — Extend `portfolioOverview` with aggregate velocity, cycle time percentiles, team-wide sprint progress.
- [ ] **Scheduled report delivery** — `ReportSchedule { reportType, projectId, cronExpression, recipientUserIds }`. Reuse existing AI report generators. Deliver via email or Slack webhook.

### Hierarchy
- [ ] **Multi-level hierarchy UI** — Schema already supports arbitrary nesting via `parentTaskId`. Add recursive rendering in EpicsView/TaskDetailPanel, breadcrumb navigation, `taskType: 'initiative'`.

### Time Tracking
- [ ] **TimeEntry model** — `TimeEntry { taskId, userId, minutes, description, loggedDate, billable }`. Log/update/delete mutations. Show logged vs estimated in task detail and sprint reports.

### Permissions
- [ ] **Permission scheme** — Define `Permission` enum (VIEW_TASKS, CREATE_TASKS, EDIT_TASKS, TRANSITION_TASKS, MANAGE_SPRINTS, etc.). Map roles→permissions. Check in resolvers via `requirePermission()`. Initially hardcoded mapping, later configurable.

---

## Competitive Gap — P2 (Differentiators / Enterprise)

Nice-to-haves and enterprise features for later.

### Planning & Estimation
- [ ] **Monte Carlo forecasting** — Sample from historical velocity distribution, project sprint completion probability. Pure computation over existing `sprintVelocity` data.

### Views & Visualization
- [ ] **Cycle time scatter / control chart** — Query activity for done-tasks in time window, compute cycle time, plot with percentile overlay lines (50th, 85th, 95th).

### Search & Filtering
- [ ] **Query language (TQL)** — PEG parser compiling to FilterGroup structure. Syntax: `status:in_progress AND (priority:high OR label:"urgent")`. Deferred until filter infrastructure is solid.

### Collaboration
- [ ] **Approval workflows** — `Approval { taskId, requesterId, approverId, status: pending|approved|rejected }`. Optionally triggers workflow transitions.

### Automation
- [ ] **Scheduled triggers** — `scheduleExpression` (cron) field on AutomationRule. Lightweight job scheduler evaluates rules on schedule.

### Reporting
- [ ] **Workload heatmap** — Tasks grouped by assignee + week(dueDate). Calendar grid colored by load (green/yellow/red).

### Hierarchy
- [ ] **Cross-project initiatives** — `Initiative { initiativeId, orgId, name, targetDate, status }` + `initiativeId` FK on Task. Portfolio-level tracking.

### Time Tracking
- [ ] **Auto-tracking from status transitions** — Start timer on In Progress, stop on exit. Store as `TimeEntry` with `autoTracked: true`.
- [ ] **Timesheet view** — Weekly grid: rows=tasks, columns=days, cells=logged hours.

### Permissions
- [ ] **Workflow-based permissions** — `allowedRoles` on `WorkflowTransition`. Only matching roles can perform specific transitions.
- [ ] **Field-level edit restrictions** — `FieldPermission { projectId, fieldName, editableByRoles }`. Check in `updateTask` per field.
