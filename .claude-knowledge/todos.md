# Deferred Ideas & Future Improvements

Organized by module touchpoints for parallel development. Items within the same group share files and should NOT be worked on simultaneously. Items in different groups can safely be parallelized — **unless they share a hotspot file** (see Cross-Group Dependencies below).

Completed items (`[x]`) indicate work done locally but not yet pushed. Remove items once pushed to remote.

---

## Cross-Group Dependencies

These shared files create blocking relationships between groups. The planner must isolate blocker tasks (see Swarm Assignment Rules).

| Shared File | Groups |
|---|---|
| `apps/api/src/graphql/schema.ts` (typeDefs) | A, C, D, F, H, I, K, M |
| `apps/api/prisma/schema.prisma` | A, C, F, G, H, I, K, M, O |
| `apps/web/src/hooks/useProjectData.ts` | B, E, F |

### Swarm Assignment Rules

1. **Isolate cross-group blockers.** If a task touches a shared file that other groups also need, it must run in its own isolated set (or be serialized before the groups it blocks).
2. **Bundle safe dependents.** If task B depends only on task A (not on any other group), A and B can share a worker set.
3. **Independent groups run in parallel.** Groups with no shared files can safely run on separate workers simultaneously.

---

## Group A: AI Subsystem
**Touches:** `apps/api/src/ai/*`, `apps/api/src/graphql/resolvers/ai.ts`, `apps/api/src/graphql/schema.ts` (typeDefs), new frontend components
**Blocks / blocked by:** schema.ts shared with C, D, F, H, I, K, M

- [ ] Persisted reports — save reports for historical analytics _(prerequisite for Historical summary analysis)_
- [ ] Contextual project chat — NL Q&A grounded in live project data
- [ ] Bug report → Task — AI parses bug report into structured task
- [ ] PRD → Task breakdown — AI breaks PRD into epics/tasks
- [ ] GitHub repo → Project bootstrap — AI analyzes repo to generate project
- [ ] Historical summary analysis — trend analysis over persisted reports _(depends on: Persisted reports)_
- [ ] Sprint transition analyzer — AI analyzes backlog on sprint close
- [ ] Multi-file context injection — feed existing project files (components, types, routes) into code gen prompt for higher-quality output _(depends on: GitHub repo connection)_
- [ ] Code review feedback loop — AI reads PR review comments and generates fix commits, closing the task → code → PR → review → fix cycle
- [ ] AI code gen cost estimation (pre-flight) — estimate token cost from task complexity + instructions length before generating, let user decide
- [ ] AI commit message generation — AI generates meaningful commit messages from task context instead of generic "AI: implement task X"
- [ ] PR description enrichment — AI generates rich PR body with what changed, why, testing suggestions, related tasks
- [ ] Batch code generation — generate code for multiple related tasks (e.g., all subtasks of an epic) in one context, one PR _(depends on: Epics)_
- [ ] AI task decomposition from GitHub issues — import GitHub issue → AI breaks into TaskToad tasks with instructions _(also touches: Group C GitHub integration)_
- [ ] AI code review — AI reviews PRs linked to tasks, checks against requirements, flags gaps, suggests improvements _(also touches: Group C GitHub integration)_
- [ ] Prompt replay / history — save AI prompts + responses per task for debugging, re-running, and cost tracking _(also touches: schema.prisma for persistence)_
- [ ] AI cost budget per org — set monthly token budget, track cumulative usage, alert at 80%, hard stop at 100% _(also touches: schema.prisma)_
- [ ] AI activity limits — per-user/org rate limits on AI operations
- [ ] AI usage reporting — dashboard for AI usage metrics

## Group B: AI Generation UX
**Touches:** `apps/web/src/components/TaskPlanApprovalDialog.tsx`, `apps/web/src/hooks/useProjectData.ts` (AI handlers), `apps/api/src/ai/promptBuilder.ts`, `apps/web/src/components/CodePreviewModal.tsx`
**Blocks / blocked by:** useProjectData shared with E, F

- [ ] Regenerate single file — in code preview modal, regenerate one file instead of entire set to save tokens
- [ ] Code gen templates / style guides — per-project config injected into code gen prompt ("use React functional components", "follow this naming convention") _(overlaps with Project knowledge base)_

> **Note:** The following items also touch `schema.prisma` + `schema.ts` and should be isolated when planned:
- [ ] Acceptance criteria in task generation — add acceptance criteria field _(also touches: schema.prisma, schema.ts, TaskDetailPanel)_
- [ ] Project knowledge base — per-project context injected into AI prompts _(also touches: schema.prisma, schema.ts, new settings UI)_

## Group C: External Integrations
**Touches:** new backend services, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/src/graphql/resolvers/github.ts`, `apps/api/prisma/schema.prisma`, new frontend components, `apps/web/src/pages/OrgSettings.tsx`
**Blocks / blocked by:** schema.ts shared with A, D, F, H, I, K, M; schema.prisma shared with F, G, H, I, K, M, O

- [ ] Generated code diff view — show diff against existing repo files (new vs modified) in code preview modal instead of raw files _(depends on: GitHub repo connection)_
- [ ] Slack integration — channel notifications, create tasks from Slack
- [ ] Webhook support — outgoing webhooks on task events
- [ ] Public REST/GraphQL API docs — documented API for third-party use

## Group D: Notification System
**Touches:** `apps/api/src/utils/notification.ts`, `apps/api/src/utils/email.ts`, `apps/api/src/graphql/resolvers/notification.ts`, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/web/src/components/NotificationCenter.tsx`, `apps/web/src/pages/AppLayout.tsx`
**Blocks / blocked by:** schema.ts shared with A, C, F, H, I, K, M

- [ ] Email notifications — configurable email alerts (assigned, due date, mentioned, sprint events)
- [ ] Notification preferences — per-user settings for notification channels (in-app, email, both)
- [ ] Due date reminders — scheduled alerts before task due dates (1 day, 1 hour)
- [ ] Activity / audit log export — export project activity history as CSV or JSON for compliance/reporting

## Group E: New Views
**Touches:** new `apps/web/src/components/` files, `apps/web/src/pages/ProjectDetail.tsx`, `apps/web/src/hooks/useProjectData.ts`
**Blocks / blocked by:** useProjectData shared with B, F

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts _(also touches: AppLayout.tsx, new page)_
- [ ] Task dependencies visualization — visual arrows/lines showing dependency chains on board and list views, blocked task badges
- [ ] Burndown / burnup charts — visual sprint progress charts _(`sprintBurndown` query may already exist — verify before implementing)_

## Group F: Task Features
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/src/graphql/resolvers/task.ts`, `apps/web/src/components/TaskDetailPanel.tsx`, `apps/web/src/hooks/useProjectData.ts`
**Blocks / blocked by:** schema.ts shared with A, C, D, H, I, K, M; schema.prisma shared with C, G, H, I, K, M, O; useProjectData shared with B, E

- [ ] Epics / task hierarchy — multi-level grouping beyond parent → subtask (epic → story → subtask), epic progress tracking, epic board view
- [ ] Custom fields on tasks — user-defined fields per project (dropdown, number, text, date) with filtering support
- [ ] Story points estimation — alternative to `estimatedHours`, team velocity tracking based on points per sprint
- [ ] Sprint goal — text field on Sprint model describing the sprint's focus/objective
- [ ] Multiple assignees — support multiple `assigneeId`s per task for collaborative work
- [ ] Recurring tasks — auto-recreate on schedule (also needs cron/scheduler)
- [ ] File attachments on tasks — upload images/docs/screenshots (also needs storage service)
- [ ] Task templates — reusable task structures for repeated workflows

## Group G: Filter & Navigation
**Touches:** `apps/web/src/hooks/useTaskFiltering.ts`, `apps/web/src/components/shared/FilterBar.tsx`, `apps/api/prisma/schema.prisma`
**Blocks / blocked by:** schema.prisma shared with C, F, H, I, K, M, O

- [ ] Saved filters / views — save and name filter configurations for quick access
- [ ] Cross-project search — UI for `globalSearch` resolver, search tasks/comments/activities across all projects

## Group H: Permissions
**Touches:** `apps/api/src/graphql/context.ts`, `apps/api/src/graphql/resolvers/*` (auth checks), `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/prisma/schema.prisma`
**Blocks / blocked by:** schema.ts shared with A, C, D, F, I, K, M; schema.prisma shared with C, F, G, I, K, M, O

- [ ] Project-level roles — per-project access control (viewer, editor, admin)

## Group I: Workflow & Automation
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (typeDefs), new automation engine, new frontend settings UI
**Blocks / blocked by:** schema.ts shared with A, C, D, F, H, K, M; schema.prisma shared with C, F, G, H, K, M, O

- [ ] Automation rules — configurable triggers (e.g. "when Done → notify assignee")

## Group K: Data Layer (Tech Debt)
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/src/graphql/resolvers/*`
**Blocks / blocked by:** schema.ts shared with A, C, D, F, H, I, M; schema.prisma shared with C, F, G, H, I, M, O

- [ ] JSON string columns → Prisma Json type — Sprint.columns, Task.suggestedTools
- [ ] Shared types between API and web — consider graphql-codegen or shared package

## Group L: Infrastructure (no app code)
**Touches:** new config files only (.github/workflows, Dockerfile, deploy configs)
**Independent** — no shared files with other groups

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production deployment (Railway, Render, or Fly.io)

## Group M: User & Profile
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/src/graphql/resolvers/auth.ts`, new frontend components
**Blocks / blocked by:** schema.ts shared with A, C, D, F, H, I, K; schema.prisma shared with C, F, G, H, I, K, O

- [ ] User avatars — upload/set profile avatar, display on task cards, board, comments, and assignee dropdowns
- [ ] Profile management — edit display name, timezone, notification prefs from user settings page

## Group N: Real-time
**Touches:** `apps/api/src/index.ts` or `apps/api/src/app.ts` (websocket/SSE setup), new client-side hooks
**Independent** — new transport layer, no shared files with other groups

- [ ] Real-time updates (websockets or SSE) — push task/sprint/comment changes to all connected clients, no page refresh needed

## Group O: Data Portability
**Touches:** new API routes, `apps/api/prisma/schema.prisma` (read-only queries), new frontend components
**Blocks / blocked by:** schema.prisma shared with C, F, G, H, I, K, M

- [ ] CSV import — import tasks from CSV with column mapping UI
- [ ] Project export — export project data (tasks, sprints, comments) as CSV or JSON
