# Deferred Ideas & Future Improvements

Organized into **Task Sets** optimized for parallel swarm development. Each set is self-contained — a single worker handles it start to finish without blocking or being blocked by other workers running simultaneously.

Completed items (`[x]`) indicate work done locally but not yet pushed. Remove items once pushed to remote.

---

## Parallel Execution Model

Sets are categorized as:
- **Schema set** — touches `schema.ts` (typeDefs) and/or `schema.prisma`. Only ONE schema set runs per wave.
- **Independent set** — no shared file conflicts. Can run alongside any other set.

Each **wave** = 1 schema set + N independent sets running in parallel.

### Swarm Assignment Rules

1. **One schema set per wave.** Never assign two schema sets to separate workers simultaneously.
2. **Independent sets run freely.** Assign to any available worker in any wave.
3. **Workers work uninterrupted.** Each set is fully self-contained — no cross-set dependencies within a wave.
4. **Priority order for schema sets.** When choosing which schema set to run next, follow the priority number.

---

## Schema Sets (run one at a time, in priority order)

### S3 (Priority 2): Project Intelligence
**Touches:** `schema.prisma`, `schema.ts`, `resolvers/ai.ts`, `ai/promptBuilder.ts`, `TaskDetailPanel.tsx`, new settings UI

- [ ] Project knowledge base — per-project context injected into AI prompts
- [ ] Acceptance criteria in task generation — add acceptance criteria field to Task model

### S4 (Priority 3): GitHub Automation
**Touches:** `schema.ts`, `resolvers/ai.ts`, `resolvers/github.ts`, `ai/*`, `github/*`

- [ ] Code review feedback loop — AI reads PR review comments and generates fix commits
- [ ] AI code review — AI reviews PRs linked to tasks, checks against requirements, suggests improvements
- [ ] AI task decomposition from GitHub issues — import GitHub issue → AI breaks into TaskToad tasks with instructions
- [ ] Generated code diff view — show diff against existing repo files in code preview modal

### S5 (Priority 3): Notifications & Email
**Touches:** `schema.prisma`, `schema.ts`, `resolvers/notification.ts`, `notification.ts`, `email.ts`, `NotificationCenter.tsx`, `AppLayout.tsx`

- [ ] Email notifications — configurable email alerts (assigned, due date, mentioned, sprint events)
- [ ] Notification preferences — per-user settings for notification channels (in-app, email, both)
- [ ] Due date reminders — scheduled alerts before task due dates (1 day, 1 hour)

### S6 (Priority 4): User & Profile
**Touches:** `schema.prisma`, `schema.ts`, `resolvers/auth.ts`, new frontend components

- [ ] User avatars — upload/set profile avatar, display on task cards, board, comments, and assignee dropdowns
- [ ] Profile management — edit display name, timezone, notification prefs from user settings page

### S7 (Priority 4): External Integrations
**Touches:** `schema.prisma`, `schema.ts`, new backend services, `OrgSettings.tsx`

- [ ] Slack integration — channel notifications, create tasks from Slack
- [ ] Webhook support — outgoing webhooks on task events

### S8 (Priority 5): Advanced Task Features
**Touches:** `schema.prisma`, `schema.ts`, `resolvers/task.ts`, `TaskDetailPanel.tsx`, `useProjectData.ts`

- [ ] Custom fields on tasks — user-defined fields per project (dropdown, number, text, date) with filtering support
- [ ] Multiple assignees — support multiple `assigneeId`s per task for collaborative work
- [ ] Recurring tasks — auto-recreate on schedule (also needs cron/scheduler)
- [ ] File attachments on tasks — upload images/docs/screenshots (also needs storage service)
- [ ] Task templates — reusable task structures for repeated workflows

### S9 (Priority 5): Permissions & Automation
**Touches:** `schema.prisma`, `schema.ts`, `context.ts`, `resolvers/*`, new automation engine, new frontend settings

- [ ] Project-level roles — per-project access control (viewer, editor, admin)
- [ ] Automation rules — configurable triggers (e.g. "when Done → notify assignee")

### S10 (Priority 5): Filters & Tech Debt
**Touches:** `schema.prisma`, `schema.ts`, `resolvers/*`, `useTaskFiltering.ts`, `FilterBar.tsx`

- [ ] Saved filters / views — save and name filter configurations for quick access
- [ ] JSON string columns → Prisma Json type — Sprint.columns, Task.suggestedTools
- [ ] Shared types between API and web — consider graphql-codegen or shared package

---

## Independent Sets (run alongside any schema set)

### I5 (Priority 3): New AI Features (no schema changes)
**Touches:** `ai/*`, `resolvers/ai.ts`, `promptBuilder.ts` — reuse existing mutations/types

- [ ] Bug report → Task — AI parses bug report into structured task _(reuse existing `extractTasksFromNotes` mutation)_
- [ ] Sprint transition analyzer — AI analyzes backlog on sprint close
- [ ] PRD → Task breakdown — AI breaks PRD into epics/tasks
- [ ] GitHub repo → Project bootstrap — import existing repo, AI analyzes codebase structure (files, languages, README, package.json) to auto-generate project with initial task breakdown
- [ ] Repo ↔ Task drift analysis — for projects with a linked repo, AI compares current repo state (recent commits, open PRs, file changes) against the task set to flag outdated tasks, suggest new tasks for untracked work, and identify completed tasks that haven't been marked done
- [ ] Contextual project chat — NL Q&A grounded in live project data
- [ ] Historical summary analysis — trend analysis over persisted reports
- [ ] Batch code generation — generate code for multiple related tasks in one PR _(depends on: Epics — completed)_
- [ ] Prompt replay / history — save AI prompts + responses per task for debugging and cost tracking

> **Note:** Some items above (sprint transition, contextual chat, prompt history) may need new schema.ts queries when planned in detail. If so, the planner should move them to a schema set or batch their schema changes into the same wave's schema set.

### I6 (Priority 3): Data Export
**Touches:** new REST routes in `app.ts` — no schema changes, reads existing data

- [ ] Activity / audit log export — export project activity history as CSV or JSON
- [ ] Project export — export project data (tasks, sprints, comments) as CSV or JSON
- [ ] CSV import — import tasks from CSV with column mapping UI

### I7 (Priority 3): Real-time
**Touches:** `app.ts` (websocket/SSE setup), new client-side hooks — independent transport layer

- [ ] Real-time updates (websockets or SSE) — push task/sprint/comment changes to all connected clients

### I8 (Priority 3): Advanced Views
**Touches:** new `apps/web/src/components/` files, `ProjectDetail.tsx`, `useProjectData.ts`

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts
- [ ] Public REST/GraphQL API docs — documented API for third-party use

---

## Optimal Wave Plan (3 workers)

| Wave | Worker 1 (schema) | Worker 2 (independent) | Worker 3 (independent) |
|------|-------------------|----------------------|----------------------|
| 3 | **S3** Project Intelligence | **I5** New AI Features | **I6** Data Export |
| 4 | **S4** GitHub Automation | **I7** Real-time | **I8** Advanced Views |
| 5 | **S5** Notifications & Email | _(remaining I sets)_ | _(remaining I sets)_ |
| 6 | **S6** User & Profile | | |
| 7 | **S7** External Integrations | | |
| 8 | **S8** Advanced Task Features | | |
| 9 | **S9** Permissions & Automation | | |
| 10 | **S10** Filters & Tech Debt | | |
