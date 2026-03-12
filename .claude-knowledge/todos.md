# Deferred Ideas & Future Improvements

Items that came up during development but were deferred. Revisit when relevant.

---

## Auth / Account

_(all items completed 2026-03-12)_

## Data / Product

_(all items completed 2026-03-12)_

## Technical Debt

- [ ] Shared types between API and web — duplicated in `apps/web/src/types.ts`; consider graphql-codegen
- [ ] Error handling in resolvers is minimal — GraphQL errors could be more structured
- [ ] No structured logging (only console.error) — consider pino
- [ ] Monolithic `schema.ts` (~920 lines) — split into domain-specific resolver modules
- [ ] `ProjectDetail.tsx` is a god component (~830 lines, 20+ useState) — extract custom hooks
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
