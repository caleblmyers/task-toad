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

### S1 (Priority 1): Core PM Foundation
**Touches:** `schema.prisma`, `schema.ts`, `resolvers/task.ts`, `resolvers/sprint.ts`, `TaskDetailPanel.tsx`, `useProjectData.ts`

- [ ] Epics / task hierarchy — multi-level grouping beyond parent → subtask (epic → story → subtask), epic progress tracking, epic board view
- [ ] Sprint goal — text field on Sprint model describing the sprint's focus/objective
- [ ] Story points estimation — alternative to `estimatedHours`, team velocity tracking based on points per sprint

### S2 (Priority 2): AI Persistence & Cost Control
**Touches:** `schema.prisma`, `schema.ts`, `resolvers/ai.ts`, `ai/*`, new frontend components

- [ ] Persisted reports — save reports for historical analytics _(prerequisite for Historical summary analysis)_
- [ ] AI cost budget per org — set monthly token budget, track cumulative usage, alert at 80%, hard stop at 100%
- [ ] AI activity limits — per-user/org rate limits on AI operations
- [ ] AI usage reporting — dashboard for AI usage metrics

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

### I1 (Priority 1): AI Pipeline Polish
**Touches:** `ai/*`, `promptBuilder.ts`, `githubService.ts` — no schema changes needed

- [ ] AI commit message generation — enhance PR commit messages with AI-generated context instead of generic "AI: implement task X"
- [ ] PR description enrichment — AI generates rich PR body with what changed, why, testing suggestions, related tasks
- [ ] Multi-file context injection — feed existing project files into code gen prompt via GitHub file fetch for higher-quality output
- [ ] AI code gen cost estimation (pre-flight) — use existing `tokenEstimator` + `estimatedTokensUsed` field to show cost before generating

### I2 (Priority 1): Code Gen UX
**Touches:** `CodePreviewModal.tsx`, `TaskPlanApprovalDialog.tsx`, `useProjectData.ts`, `promptBuilder.ts` — no schema changes

- [ ] Regenerate single file — in code preview modal, regenerate one file instead of entire set to save tokens
- [ ] Code gen templates / style guides — per-project config injected into code gen prompt

### I3 (Priority 2): Infrastructure
**Touches:** new config files only — fully independent

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production deployment (Railway, Render, or Fly.io)

### I4 (Priority 2): Frontend Views (no backend changes)
**Touches:** new `apps/web/src/components/` files, `ProjectDetail.tsx` — uses existing queries/data

- [ ] Burndown / burnup charts — visual sprint progress charts using existing `sprintBurndown` query
- [ ] Task dependencies visualization — visual arrows/lines showing dependency chains, reads existing `dependsOn` field
- [ ] Cross-project search — UI for existing `globalSearch` resolver, search across all projects

### I5 (Priority 3): New AI Features (no schema changes)
**Touches:** `ai/*`, `resolvers/ai.ts`, `promptBuilder.ts` — reuse existing mutations/types

- [ ] Bug report → Task — AI parses bug report into structured task _(reuse existing `extractTasksFromNotes` mutation)_
- [ ] Sprint transition analyzer — AI analyzes backlog on sprint close
- [ ] PRD → Task breakdown — AI breaks PRD into epics/tasks
- [ ] GitHub repo → Project bootstrap — import existing repo, AI analyzes codebase structure (files, languages, README, package.json) to auto-generate project with initial task breakdown
- [ ] Repo ↔ Task drift analysis — for projects with a linked repo, AI compares current repo state (recent commits, open PRs, file changes) against the task set to flag outdated tasks, suggest new tasks for untracked work, and identify completed tasks that haven't been marked done
- [ ] Contextual project chat — NL Q&A grounded in live project data
- [ ] Historical summary analysis — trend analysis over persisted reports _(depends on: S2 Persisted reports)_
- [ ] Batch code generation — generate code for multiple related tasks in one PR _(depends on: S1 Epics)_
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
| 1 | **S1** Core PM Foundation | **I1** AI Pipeline Polish | **I3** Infrastructure |
| 2 | **S2** AI Persistence & Costs | **I2** Code Gen UX | **I4** Frontend Views |
| 3 | **S3** Project Intelligence | **I5** New AI Features | **I6** Data Export |
| 4 | **S4** GitHub Automation | **I7** Real-time | **I8** Advanced Views |
| 5 | **S5** Notifications & Email | _(remaining I sets)_ | _(remaining I sets)_ |
| 6 | **S6** User & Profile | | |
| 7 | **S7** External Integrations | | |
| 8 | **S8** Advanced Task Features | | |
| 9 | **S9** Permissions & Automation | | |
| 10 | **S10** Filters & Tech Debt | | |
