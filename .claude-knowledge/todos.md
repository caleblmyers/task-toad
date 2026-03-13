# Deferred Ideas & Future Improvements

Organized by module touchpoints for parallel development. Items within the same group share files and should NOT be worked on simultaneously. Items in different groups can safely be parallelized.

---

## Group A: AI Subsystem
**Touches:** `apps/api/src/ai/*`, `apps/api/src/graphql/schema.ts` (AI resolvers), new frontend components

- [ ] Meeting notes → Tasks — paste notes, AI extracts tasks + updates
- [ ] Daily standup report — generate from sprint data
- [ ] Sprint report — auto-generate on sprint close
- [ ] Persisted reports — save reports for historical analytics _(prerequisite for Historical summary analysis)_
- [ ] Project health analyzer — AI health score + issue summary
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

- [ ] Graceful rejection handling — stop retrying when all options rejected
- [ ] Iterative generation input — allow refinements during generation
- [ ] Acceptance criteria in task generation — add acceptance criteria field _(also touches: schema.prisma, schema.ts, TaskDetailPanel)_
- [ ] Project knowledge base — per-project context injected into AI prompts _(also touches: schema.prisma, schema.ts, new settings UI)_

## Group C: External Integrations
**Touches:** new backend services, `apps/api/src/graphql/schema.ts` (new resolvers), `apps/api/prisma/schema.prisma` (new models), new frontend components

- [ ] GitHub integration — link commits/PRs to tasks, auto-update status
- [ ] Slack integration — channel notifications, create tasks from Slack
- [ ] Webhook support — outgoing webhooks on task events
- [ ] Public REST/GraphQL API docs — documented API for third-party use

## Group D: Notification System
**Touches:** `apps/api/src/utils/notification.ts`, `apps/api/src/utils/email.ts`, `apps/api/src/graphql/schema.ts` (notification resolvers), `apps/web/src/components/NotificationCenter.tsx`, `apps/web/src/pages/AppLayout.tsx`

- [ ] Email notifications — configurable email alerts (assigned, due date, mentioned, sprint events)
- [ ] Notification preferences — per-user settings for notification channels (in-app, email, both)

## Group E: New Views
**Touches:** new `apps/web/src/components/` files, `apps/web/src/pages/ProjectDetail.tsx`, `apps/web/src/hooks/useProjectData.ts`

- [ ] Timeline / Gantt view — horizontal bars showing task duration + dependencies
- [ ] Portfolio / multi-project overview — cross-project summary with health, progress, overdue counts _(also touches: AppLayout.tsx, new page)_

## Group F: Task Features
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts` (task resolvers), `apps/web/src/components/TaskDetailPanel.tsx`, `apps/web/src/hooks/useProjectData.ts`

- [ ] Recurring tasks — auto-recreate on schedule (also needs cron/scheduler)
- [ ] File attachments on tasks — upload images/docs/screenshots (also needs storage service)
- [ ] Task templates — reusable task structures for repeated workflows

## Group G: Filter & Navigation
**Touches:** `apps/web/src/hooks/useTaskFiltering.ts`, `apps/web/src/components/shared/FilterBar.tsx`, `apps/api/prisma/schema.prisma`

- [ ] Saved filters / views — save and name filter configurations for quick access

## Group H: Permissions
**Touches:** `apps/api/src/graphql/context.ts`, `apps/api/src/graphql/schema.ts` (auth checks), `apps/api/prisma/schema.prisma`

- [ ] Project-level roles — per-project access control (viewer, editor, admin)

## Group I: Workflow & Automation
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts`, new automation engine, new frontend settings UI

- [ ] Automation rules — configurable triggers (e.g. "when Done → notify assignee")

## Group J: API Architecture (Tech Debt)
**Touches:** `apps/api/src/graphql/schema.ts`, `apps/api/src/graphql/context.ts`

- [ ] Split monolithic schema.ts — break into domain-specific resolver modules (~2000+ lines)
- [ ] Structured error handling — more structured GraphQL errors in resolvers
- [ ] Structured logging (pino) — replace console.error across API

## Group K: Data Layer (Tech Debt)
**Touches:** `apps/api/prisma/schema.prisma`, `apps/api/src/graphql/schema.ts`

- [ ] JSON string columns → Prisma Json type — Sprint.columns, Task.suggestedTools
- [ ] Shared types between API and web — consider graphql-codegen or shared package

## Group L: Infrastructure (no app code)
**Touches:** new config files only (.github/workflows, Dockerfile, deploy configs)

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production deployment (Railway, Render, or Fly.io)
