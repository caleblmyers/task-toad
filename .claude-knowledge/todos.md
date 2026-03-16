# Deferred Ideas & Future Improvements

Organized into **Task Sets** optimized for parallel swarm development. Each set is self-contained — a single worker handles it start to finish without blocking or being blocked by other workers running simultaneously.

---

## Parallel Execution Model (updated 2026-03-16)

Both `schema.prisma` and `schema.ts` have been **modularized into domain files**:
- Prisma: `apps/api/prisma/schema/` — one `.prisma` file per domain (auth, org, project, task, sprint, etc.)
- GraphQL typeDefs: `apps/api/src/graphql/typedefs/` — one `.ts` file per domain
- Resolvers: `apps/api/src/graphql/resolvers/` — already split by domain

**This means the old "only 1 schema set per wave" constraint is relaxed.** Sets that touch *different* domain files can now run in parallel. The constraint only applies when two sets modify the *same* domain file (e.g., both touching `typedefs/task.ts`).

### Swarm Assignment Rules

1. **Check file overlap.** Two sets can run in parallel if their `files` arrays don't overlap.
2. **Independent sets run freely.** Assign to any available worker in any wave.
3. **Workers work uninterrupted.** Each set is fully self-contained — no cross-set dependencies within a wave.

---

## Remaining Task Sets

### S3: Project Intelligence
**Touches:** `prisma/schema/project.prisma`, `prisma/schema/task.prisma`, `typedefs/project.ts`, `typedefs/task.ts`, `resolvers/ai.ts`, `ai/promptBuilder.ts`, `TaskDetailPanel.tsx`

- [ ] Project knowledge base — per-project context injected into AI prompts
- [ ] Acceptance criteria in task generation — add acceptance criteria field to Task model

### S4: GitHub Automation
**Touches:** `typedefs/github.ts`, `typedefs/ai.ts`, `resolvers/ai.ts`, `resolvers/github.ts`, `ai/*`, `github/*`

- [ ] Code review feedback loop — AI reads PR review comments and generates fix commits
- [ ] AI code review — AI reviews PRs linked to tasks, checks against requirements, suggests improvements
- [ ] AI task decomposition from GitHub issues — import GitHub issue → AI breaks into TaskToad tasks with instructions
- [ ] Generated code diff view — show diff against existing repo files in code preview modal

### S5: Notifications & Email
**Touches:** `prisma/schema/notification.prisma`, `prisma/schema/auth.prisma`, `typedefs/notification.ts`, `resolvers/notification.ts`, `NotificationCenter.tsx`, `AppLayout.tsx`

- [ ] Email notifications — configurable email alerts (assigned, due date, mentioned, sprint events)
- [ ] Notification preferences — per-user settings for notification channels (in-app, email, both)
- [ ] Due date reminders — scheduled alerts before task due dates (1 day, 1 hour)

### S6: User & Profile
**Touches:** `prisma/schema/auth.prisma`, `typedefs/auth.ts`, `resolvers/auth.ts`, new frontend components

- [ ] User avatars — upload/set profile avatar, display on task cards, board, comments, and assignee dropdowns
- [ ] Profile management — edit display name, timezone, notification prefs from user settings page

### S7: External Integrations
**Touches:** `prisma/schema/org.prisma`, `typedefs/org.ts`, new backend services, `OrgSettings.tsx`

- [ ] Slack integration — channel notifications, create tasks from Slack
- [ ] Webhook support — outgoing webhooks on task events

### S8: Advanced Task Features
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/task.ts`, `TaskDetailPanel.tsx`, `useProjectData.ts`

- [ ] Custom fields on tasks — user-defined fields per project (dropdown, number, text, date) with filtering support
- [ ] Multiple assignees — support multiple `assigneeId`s per task for collaborative work
- [ ] Recurring tasks — auto-recreate on schedule (also needs cron/scheduler)
- [ ] File attachments on tasks — upload images/docs/screenshots (also needs storage service)
- [ ] Task templates — reusable task structures for repeated workflows

### S9: Permissions & Automation
**Touches:** `prisma/schema/` (new models), `typedefs/` (new files), `context.ts`, `resolvers/*`, new automation engine

- [ ] Project-level roles — per-project access control (viewer, editor, admin)
- [ ] Automation rules — configurable triggers (e.g. "when Done → notify assignee")

### S10: Filters & Tech Debt
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/*`, `useTaskFiltering.ts`, `FilterBar.tsx`

- [ ] Saved filters / views — save and name filter configurations for quick access
- [ ] JSON string columns → Prisma Json type — Sprint.columns, Task.suggestedTools
- [ ] Shared types between API and web — consider graphql-codegen or shared package

---

## Independent Sets (run alongside any other set)

### I5: New AI Features
**Touches:** `ai/*`, `resolvers/ai.ts`, `promptBuilder.ts` — reuse existing mutations/types

- [ ] Deduplicate "add more tasks" — prevent AI task generation from creating tasks that duplicate existing task titles in the project
- [ ] Bug report → Task — AI parses bug report into structured task _(reuse existing `extractTasksFromNotes` mutation)_
- [ ] Sprint transition analyzer — AI analyzes backlog on sprint close
- [ ] PRD → Task breakdown — AI breaks PRD into epics/tasks
- [ ] GitHub repo → Project bootstrap — import existing repo, AI analyzes codebase structure (files, languages, README, package.json) to auto-generate project with initial task breakdown
- [ ] Repo ↔ Task drift analysis — for projects with a linked repo, AI compares current repo state (recent commits, open PRs, file changes) against the task set to flag outdated tasks, suggest new tasks for untracked work, and identify completed tasks that haven't been marked done
- [ ] Contextual project chat — NL Q&A grounded in live project data
- [ ] Historical summary analysis — trend analysis over persisted reports
- [ ] Batch code generation — generate code for multiple related tasks in one PR _(depends on: Epics — completed)_
- [ ] Prompt replay / history — save AI prompts + responses per task for debugging and cost tracking

> **Note:** Some items above (sprint transition, contextual chat, prompt history) may need new typeDef/resolver files when planned in detail. If so, the planner should note the specific domain files touched.

### I7: Real-time
**Touches:** `app.ts` (websocket/SSE setup), new client-side hooks — independent transport layer

- [ ] Real-time updates (websockets or SSE) — push task/sprint/comment changes to all connected clients

### I8: Advanced Views
**Touches:** new `apps/web/src/components/` files, `ProjectDetail.tsx`, `useProjectData.ts`

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts
- [ ] Public REST/GraphQL API docs — documented API for third-party use

---

## Completed

### I6: Data Export (Wave 3, 2026-03-16)
- [x] Activity / audit log export — REST endpoints for CSV/JSON
- [x] Project export — REST endpoints for CSV/JSON
- [x] CSV import — column mapping UI with client-side parsing

### Schema Modularization (Wave 3, 2026-03-16)
- [x] Split `schema.prisma` into domain-based files in `prisma/schema/`
- [x] Split `schema.ts` typeDefs into domain-based modules in `graphql/typedefs/`

---

## Parallelism Matrix (which sets can run together)

Sets that **conflict** (share domain files):
- S3 + S8 (both touch `task.prisma`, `typedefs/task.ts`)
- S5 + S6 (both touch `auth.prisma`)
- S3 + S10 (both touch `task.prisma`, `typedefs/task.ts`)
- S8 + S10 (both touch `task.prisma`, `typedefs/task.ts`)

Sets that **can run in parallel** (no file overlap):
- S3 + S4 + S5 (project/task vs github/ai vs notification)
- S4 + S6 + S7 (github vs auth vs org)
- S3 + S7 + I5 (project vs org vs ai-only)
- Any I-set with any S-set (I-sets don't touch schema files)
