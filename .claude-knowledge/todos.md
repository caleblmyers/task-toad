# Deferred Ideas & Future Improvements

Organized by module touchpoints for parallel development. Items within the same group share files and should NOT be worked on simultaneously. Items in different groups can safely be parallelized — **unless they share a hotspot file** (see Cross-Group Dependencies below).

---

## Cross-Group Dependencies

These shared files create blocking relationships between groups. The planner must isolate blocker tasks (see Swarm Assignment Rules).

| Shared File | Groups |
|---|---|
| `apps/api/src/graphql/schema.ts` (typeDefs) | A, C, D, F, H, I, K |
| `apps/api/prisma/schema.prisma` | C, F, G, H, I, K |
| `apps/web/src/hooks/useProjectData.ts` | B, E, F |

### Swarm Assignment Rules

1. **Isolate cross-group blockers.** If a task touches a shared file that other groups also need, it must run in its own isolated set (or be serialized before the groups it blocks).
2. **Bundle safe dependents.** If task B depends only on task A (not on any other group), A and B can share a worker set.
3. **Independent groups run in parallel.** Groups with no shared files can safely run on separate workers simultaneously.

---

## Group A: AI Subsystem
**Touches:** `apps/api/src/ai/*`, `apps/api/src/graphql/resolvers/ai.ts`, `apps/api/src/graphql/schema.ts` (typeDefs), new frontend components
**Blocks / blocked by:** schema.ts shared with C, D, F, H, I, K

- [x] Meeting notes → Tasks — paste notes, AI extracts tasks + updates
- [x] Daily standup report — generate from sprint data
- [x] Sprint report — auto-generate on sprint close
- [x] Project health analyzer — AI health score + issue summary
- [ ] Persisted reports — save reports for historical analytics _(prerequisite for Historical summary analysis)_
- [ ] Contextual project chat — NL Q&A grounded in live project data
- [ ] Bug report → Task — AI parses bug report into structured task
- [ ] PRD → Task breakdown — AI breaks PRD into epics/tasks
- [ ] GitHub repo → Project bootstrap — AI analyzes repo to generate project
- [ ] Historical summary analysis — trend analysis over persisted reports _(depends on: Persisted reports)_
- [ ] Sprint transition analyzer — AI analyzes backlog on sprint close
- [ ] AI activity limits — per-user/org rate limits on AI operations
- [ ] AI usage reporting — dashboard for AI usage metrics

## Group B: AI Generation UX
**Touches:** `apps/web/src/components/TaskPlanApprovalDialog.tsx`, `apps/web/src/hooks/useProjectData.ts` (AI handlers), `apps/api/src/ai/promptBuilder.ts`
**Blocks / blocked by:** useProjectData shared with E, F

- [ ] Graceful rejection handling — stop retrying when all options rejected
- [ ] Iterative generation input — allow refinements during generation

> **Note:** The following items also touch `schema.prisma` + `schema.ts` and should be isolated when planned:
- [ ] Acceptance criteria in task generation — add acceptance criteria field _(also touches: schema.prisma, schema.ts, TaskDetailPanel)_
- [ ] Project knowledge base — per-project context injected into AI prompts _(also touches: schema.prisma, schema.ts, new settings UI)_

## Group C: External Integrations
**Touches:** new backend services, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/src/graphql/resolvers/github.ts`, `apps/api/prisma/schema.prisma`, new frontend components, `apps/web/src/pages/OrgSettings.tsx`
**Blocks / blocked by:** schema.ts shared with A, D, F, H, I, K; schema.prisma shared with F, G, H, I, K

- [x] GitHub App integration — GitHub App auth, webhooks, installation storage
- [x] GitHub linking UI — OrgSettings installation linking, ProjectDetail repo connection modal
- [x] GitHub issue sync — create GitHub issues from TaskToad tasks, sync status bidirectionally
- [x] PR status on tasks — show linked PR status (open/merged/closed) on task cards
- [x] Auto-link commits — parse branch names to associate commits with tasks
- [ ] Slack integration — channel notifications, create tasks from Slack
- [ ] Webhook support — outgoing webhooks on task events
- [ ] Public REST/GraphQL API docs — documented API for third-party use

## Group D: Notification System
**Touches:** `apps/api/src/utils/notification.ts`, `apps/api/src/utils/email.ts`, `apps/api/src/graphql/resolvers/notification.ts`, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/web/src/components/NotificationCenter.tsx`, `apps/web/src/pages/AppLayout.tsx`
**Blocks / blocked by:** schema.ts shared with A, C, F, H, I, K

- [ ] Email notifications — configurable email alerts (assigned, due date, mentioned, sprint events)
- [ ] Notification preferences — per-user settings for notification channels (in-app, email, both)

## Group E: New Views
**Touches:** new `apps/web/src/components/` files, `apps/web/src/pages/ProjectDetail.tsx`, `apps/web/src/hooks/useProjectData.ts`
**Blocks / blocked by:** useProjectData shared with B, F

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts _(also touches: AppLayout.tsx, new page)_

## Group F: Task Features
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/src/graphql/resolvers/task.ts`, `apps/web/src/components/TaskDetailPanel.tsx`, `apps/web/src/hooks/useProjectData.ts`
**Blocks / blocked by:** schema.ts shared with A, C, D, H, I, K; schema.prisma shared with C, G, H, I, K; useProjectData shared with B, E

- [ ] Recurring tasks — auto-recreate on schedule (also needs cron/scheduler)
- [ ] File attachments on tasks — upload images/docs/screenshots (also needs storage service)
- [ ] Task templates — reusable task structures for repeated workflows

## Group G: Filter & Navigation
**Touches:** `apps/web/src/hooks/useTaskFiltering.ts`, `apps/web/src/components/shared/FilterBar.tsx`, `apps/api/prisma/schema.prisma`
**Blocks / blocked by:** schema.prisma shared with C, F, H, I, K

- [ ] Saved filters / views — save and name filter configurations for quick access

## Group H: Permissions
**Touches:** `apps/api/src/graphql/context.ts`, `apps/api/src/graphql/resolvers/*` (auth checks), `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/prisma/schema.prisma`
**Blocks / blocked by:** schema.ts shared with A, C, D, F, I, K; schema.prisma shared with C, F, G, I, K

- [ ] Project-level roles — per-project access control (viewer, editor, admin)

## Group I: Workflow & Automation
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (typeDefs), new automation engine, new frontend settings UI
**Blocks / blocked by:** schema.ts shared with A, C, D, F, H, K; schema.prisma shared with C, F, G, H, K

- [ ] Automation rules — configurable triggers (e.g. "when Done → notify assignee")

## Group J: API Architecture (Tech Debt) — COMPLETED
**Touches:** `apps/api/src/graphql/schema.ts`, `apps/api/src/graphql/context.ts`

- [x] Split monolithic schema.ts — break into domain-specific resolver modules (~2000+ lines)
- [x] Structured error handling — more structured GraphQL errors in resolvers
- [x] Structured logging (pino) — replace console.error across API

## Group K: Data Layer (Tech Debt)
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (typeDefs), `apps/api/src/graphql/resolvers/*`
**Blocks / blocked by:** schema.ts shared with A, C, D, F, H, I; schema.prisma shared with C, F, G, H, I

- [ ] JSON string columns → Prisma Json type — Sprint.columns, Task.suggestedTools
- [ ] Shared types between API and web — consider graphql-codegen or shared package

## Group L: Infrastructure (no app code)
**Touches:** new config files only (.github/workflows, Dockerfile, deploy configs)
**Independent** — no shared files with other groups

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production deployment (Railway, Render, or Fly.io)
