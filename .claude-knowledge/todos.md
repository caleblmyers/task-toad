# Deferred Ideas & Future Improvements

Items that came up during development but were deferred. Revisit when relevant.

---

## Prioritization

Ranked list of all uncompleted items. Update as items are completed or added.

### Tier 1 — Table Stakes (high impact, users expect these)

1. **Task comments** _(Collaboration)_
2. **Activity feed** _(Collaboration)_
3. **Bulk actions** _(Task Management)_
4. **Custom statuses** _(Workflow & Automation)_
5. **Project dashboard** _(Reporting & Analytics)_
6. **Task dependencies UI** _(Task Management)_
7. **Edit project details** _(Project Management)_
8. **Auto-assign on drag to In Progress** _(Data / Product)_

### Tier 2 — Standard Features (medium impact, common across PM tools)

9. **Calendar view** _(Views)_
10. **In-app notification center** _(Notifications)_
11. **Task labels/tags** _(Task Management)_
12. **Rich text descriptions** _(Task Management)_
13. **Table view with sortable columns** _(Views)_
14. **Global search** _(Search & Navigation)_
15. **@mentions in comments** _(Collaboration)_ — depends on: task comments
16. **Task archiving UI** _(Task Management)_
17. **Burndown / burnup charts** _(Reporting & Analytics)_
18. **Sprint velocity chart** _(Reporting & Analytics)_

### Tier 3 — AI Reports & Insights

19. **Meeting notes → Tasks** _(AI)_
20. **Daily standup report** _(AI)_
21. **Sprint report** _(AI)_
22. **Persisted reports** _(AI)_
23. **Project health analyzer** _(AI)_
24. **Contextual project chat** _(AI)_
25. **Bug report → Task** _(AI)_
26. **PRD → Task breakdown** _(AI)_
27. **GitHub repo → Project bootstrap** _(AI)_
28. **Historical summary analysis** _(AI)_
29. **Sprint transition analyzer** _(AI)_

### Tier 4 — AI Generation UX

30. **Graceful rejection handling** _(AI UX)_
31. **Iterative generation input** _(AI UX)_
32. **Acceptance criteria in task generation** _(AI UX)_
33. **Project knowledge base** _(AI UX)_

### Tier 5 — Differentiators & Advanced (lower priority, not blockers)

34. **Timeline / Gantt view** _(Views)_
35. **Automation rules** _(Workflow & Automation)_
36. **GitHub integration** _(Integrations)_
37. **Slack integration** _(Integrations)_
38. **Recurring tasks** _(Task Management)_
39. **Saved filters / views** _(Search & Navigation)_
40. **Email notifications** _(Notifications)_
41. **Notification preferences** _(Notifications)_
42. **Portfolio / multi-project overview** _(Project Management)_
43. **File attachments on tasks** _(Collaboration)_
44. **Webhook support** _(Integrations)_
45. **Public REST/GraphQL API docs** _(Integrations)_
46. **Project-level roles** _(Permissions)_
47. **Task templates** _(Workflow & Automation)_

### Tier 6 — AI Usage & Limits

48. **AI activity limits** _(AI Limits)_
49. **AI usage reporting** _(AI Limits)_

### Tier 7 — Technical Debt & Infrastructure

50. Shared types between API and web _(Tech Debt)_
51. Structured error handling in resolvers _(Tech Debt)_
52. Structured logging (pino) _(Tech Debt)_
53. Split monolithic schema.ts _(Tech Debt)_
~~54. Extract ProjectDetail.tsx custom hooks _(Tech Debt)_ — DONE~~
55. JSON string columns → Prisma Json type _(Tech Debt)_
56. Task.dependsOn full ID-based storage _(Tech Debt)_
57. CI/CD pipeline _(Infrastructure)_
58. Production deployment _(Infrastructure)_

---

## Auth / Account

_(all items completed 2026-03-12)_

## Collaboration

- [ ] **Task comments** — threaded discussion on tasks; every PM tool has this as a core feature
- [ ] **Activity feed** — audit log showing who changed what and when on a task/project (status changes, assignments, etc.)
- [ ] **@mentions in comments** — notify users when mentioned in comments or descriptions _(depends on: task comments)_
- [ ] **File attachments on tasks** — upload images, docs, screenshots to tasks

## Notifications

- [ ] **In-app notification center** — bell icon with unread count; aggregated notifications for assignments, mentions, due dates, status changes
- [ ] **Email notifications** — configurable alerts for: task assigned to you, approaching due date, mentioned in comment, sprint started/closed
- [ ] **Notification preferences** — per-user settings to control which notifications they receive and how (in-app, email, or both)

## Views

- [ ] **Calendar view** — tasks plotted by due date on a month/week calendar; standard in Asana, Monday, ClickUp, Wrike, Notion
- [ ] **Timeline / Gantt view** — tasks as horizontal bars showing duration and dependencies; standard in Asana, Jira, Monday, Wrike, ClickUp
- [ ] **Table view with sortable columns** — spreadsheet-style view with sortable/resizable columns (title, status, priority, assignee, due, estimate); standard in every PM tool

## Task Management

- [ ] **Bulk actions** — multi-select tasks + batch operations (change status, assign, move to sprint, delete, archive); standard in Asana, Jira, Linear, ClickUp
- [ ] **Task labels/tags** — user-defined colored labels for cross-cutting categorization (e.g. "frontend", "bug", "design"); distinct from priority/status
- [ ] **Task dependencies UI** — visual display and manual editing of blocking/blocked-by relationships (data model exists via `dependsOn` field, but no UI to view or set them)
- [ ] **Rich text descriptions** — markdown or WYSIWYG editing for task descriptions and instructions; currently plain text only
- [ ] **Task archiving UI** — archive button in task detail panel (field exists on Task model, no UI to trigger it)
- [ ] **Recurring tasks** — tasks that auto-recreate on a schedule (weekly standup prep, monthly review, etc.)

## Workflow & Automation

- [ ] **Custom statuses** — user-defined workflow states beyond the fixed todo/in_progress/done (e.g. "In Review", "Blocked", "QA"); standard in Jira, Linear, Asana, ClickUp
- [ ] **Automation rules** — configurable triggers: "when task moves to Done, notify assignee" or "when due date passes, set priority to high"; standard in Asana, Monday, Jira, Wrike
- [ ] **Task templates** — reusable task structures for repeated workflows (e.g. "Bug report template" with pre-filled fields/subtasks)

## Reporting & Analytics

- [ ] **Burndown / burnup charts** — sprint progress visualization over time; standard in Jira, Linear, Shortcut
- [ ] **Sprint velocity chart** — historical velocity across sprints for capacity planning; standard in Jira, Linear
- [ ] **Project dashboard** — at-a-glance stats: completion %, overdue count, tasks by status/priority/assignee, sprint progress bar

## Project Management

- [ ] **Edit project details** — rename project, edit description after creation (currently immutable post-creation)
- [ ] **Portfolio / multi-project overview** — summary view across all projects showing health, progress, overdue counts; standard in Asana, Monday, Wrike

## Search & Navigation

- [ ] **Global search** — search across all projects from any page, not just within a single project
- [ ] **Saved filters / views** — save and name filter configurations for quick access (e.g. "My overdue tasks", "Unassigned critical")

## Integrations

- [ ] **GitHub integration** — link commits/PRs to tasks, auto-update task status on PR merge; standard in Jira, Linear, Shortcut
- [ ] **Slack integration** — notifications in Slack channels, create tasks from Slack messages; standard in most PM tools
- [ ] **Webhook support** — outgoing webhooks on task events for custom integrations
- [ ] **Public REST/GraphQL API docs** — documented API for third-party integrations and custom tooling

## Permissions

- [ ] **Project-level roles** — per-project access control (viewer, editor, admin) beyond org-wide admin/member; standard in Asana, Jira, Monday

## AI Reports & Insights

- [ ] **Meeting notes → Tasks** — paste meeting notes, AI extracts new tasks and matches mentions of existing tasks (updates), user reviews before committing
- [ ] **Daily standup report** — generate standup summary from sprint data: completed/in-progress/blocked tasks, assignees, time analysis, blocking chains
- [ ] **Sprint report** — auto-generate on sprint close: completed/deferred/abandoned tasks, assignees, unblocked tasks, velocity stats
- [ ] **Persisted reports** — save standup and sprint reports for historical analytics and trend tracking _(cross-cutting: required by both standup and sprint reports)_
- [ ] **Project health analyzer** — AI evaluates overdue tasks, sprint velocity trends, open bugs, blocking chains; outputs health score + issue summary
- [ ] **Contextual project chat** — natural-language Q&A grounded in live project data (tasks, sprints, assignees, dependencies); e.g. "What's blocking the release?" returns actual blocking tasks, "What should I work on next?" suggests a prioritized task with reasoning
- [ ] **Bug report → Task** — paste or submit a bug report, AI parses it into a structured investigation/fix task with repro steps, affected area, suggested assignee, and priority; user reviews before committing
- [ ] **PRD → Task breakdown** — import a PRD document, AI automatically breaks it down into epics/tasks with dependencies, estimates, and suggested sprint assignments; user reviews before committing
- [ ] **GitHub repo → Project bootstrap** — user provides a GitHub repo URL, AI analyzes the codebase (README, structure, issues, PRs) to generate an initial project with tasks, priorities, and dependencies
- [ ] **Historical summary analysis** — analyze persisted daily/sprint summaries over time to identify trends, recurring blockers, and improvement opportunities _(depends on: persisted reports)_
- [ ] **Sprint transition analyzer** — on sprint close, AI analyzes the backlog and automatically: creates new tasks, reorganizes sprint assignments, flags newly unblocked tasks, deprecates stale tasks, and assigns priorities; user reviews proposed changes before committing

## AI Generation UX

- [ ] **Graceful rejection handling** — when all plausible task options are rejected during generation, stop retrying and instead suggest the user rewrite/refine the original prompt
- [ ] **Iterative generation input** — allow users to provide additional context or refinements during generation instead of discarding and rerolling from scratch
- [ ] **Acceptance criteria in task generation** — include acceptance criteria as a baseline field in generated tasks (schema, prompts, and UI); defines "done" conditions for each task
- [ ] **Project knowledge base** — configurable business logic, preferences, and domain context per project (similar to Claude Code's CLAUDE.md/agents/skills) that gets injected into AI prompts for project-specific generation

## AI Usage & Limits

- [ ] **AI activity limits** — enforce per-user/per-org rate limits on AI operations (generation, reports, chat); track usage counts
- [ ] **AI usage reporting** — dashboard showing AI usage metrics per user/project/org (generations, tokens, costs) over time

## Data / Product

- [ ] **Auto-assign on drag to In Progress** — when a task is dragged to the "In Progress" column on the kanban board, automatically assign it to the current user if unassigned

## Technical Debt

- [ ] Shared types between API and web — duplicated in `apps/web/src/types.ts`; consider graphql-codegen
- [ ] Error handling in resolvers is minimal — GraphQL errors could be more structured
- [ ] No structured logging (only console.error) — consider pino
- [ ] Monolithic `schema.ts` (~920 lines) — split into domain-specific resolver modules
- [x] `ProjectDetail.tsx` is a god component (~830 lines, 20+ useState) — extract custom hooks
- [ ] `Sprint.columns`, `Task.dependsOn`, `Task.suggestedTools` stored as JSON strings — use Prisma `Json` type
- [ ] `Task.dependsOn` resolved to IDs at commit time but AI still outputs title strings — consider full ID-based storage

## Infrastructure

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production deployment (Railway, Render, or Fly.io are good fits)

---

## Completed

- [x] Rate limiting on auth endpoints — `express-rate-limit` (10 req/min/IP for signup/login)
- [x] Task assignment to users — `assigneeId` + `orgUsers` query
- [x] Skeleton loading states for task lists and kanban boards
- [x] Step-by-step progress indicator for AI task plan generation
- [x] Input blocking during AI generation (all controls disabled)
- [x] Navigation/tab-close warning during generation with request cancellation (AbortController)
- [x] Status ↔ kanban column bidirectional sync
- [x] Removed "Expand to subtasks" button from task detail panel
- [x] Sprint editing (rename, change columns, adjust dates) — SprintCreateModal supports edit mode
- [x] Delete sprint UI — Delete button on inactive sprints in BacklogView
- [x] `apiKeyHint` fix — decrypts stored key and returns last-4 chars of plaintext
- [x] Docker Compose for local dev — `docker-compose.yml` at repo root
- [x] Environment-based config validation — Zod schema validates required env vars at API startup
- [x] Offset-based pagination on `tasks` query — `TaskConnection { tasks, hasMore, total }` with `limit`/`offset`; "Load more" button in BacklogView
- [x] Task ordering via DnD within backlog sections — `position Float?` field + fractional indexing; native HTML5 DnD in BacklogView
- [x] Email verification on signup — `verificationToken` on User; `verifyEmail`/`sendVerificationEmail` mutations; `/verify-email` page; dev fallback logs to console
- [x] Password reset flow — `resetToken`/`resetTokenExpiry` on User; `requestPasswordReset`/`resetPassword` mutations; `/forgot-password` and `/reset-password` pages
- [x] Org member invite flow — `OrgInvite` model; `inviteOrgMember`/`acceptInvite`/`revokeInvite` mutations; `orgInvites` query; `/invite/accept` page; Team section in OrgSettings
- [x] Drag tasks between sprint sections — same DnD infra; dropping into a different section moves task + updates `sprintId`
- [x] Due dates on tasks — `dueDate String?` field; date input in TaskDetailPanel; color-coded chip in BacklogView (red/amber/slate)
- [x] Project archiving — `archived Boolean` on Project; `archiveProject` mutation (org:admin); archive/unarchive button + "Show archived" toggle in Projects list
- [x] Sprint velocity — BacklogView sprint headers show `X/Y done · Xh/Yh` computed from existing task data
