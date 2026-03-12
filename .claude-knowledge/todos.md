# Deferred Ideas & Future Improvements

Items that came up during development but were deferred. Revisit when relevant.

---

## Auth / Account

- [ ] Email verification on signup
- [ ] Password reset flow
- [ ] Org member invite flow (currently only `createOrg` adds a user)

## Data / Product

- [ ] No pagination on `projects` or `tasks` queries — will matter at scale
- [ ] Task ordering / drag-and-drop within backlog sections
- [ ] Drag tasks between sprint sections in BacklogView (currently must use TaskDetailPanel sprint select)
- [ ] Due dates on tasks (sprint start/end dates exist; per-task dates not yet)
- [ ] Project archiving
- [ ] Sprint velocity / burn-down metrics

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
