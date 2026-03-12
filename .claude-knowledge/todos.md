# Deferred Ideas & Future Improvements

Items that came up during development but were deferred. Revisit when relevant.

---

## MVP Gaps (known)

- [ ] No tests — unit or integration tests for resolvers would be valuable
- [ ] `apiKeyHint` always returns null now (last-4 of ciphertext is meaningless). Could decrypt and show last-4 of plaintext in Settings if desired.
- [ ] No email verification on signup
- [ ] No password reset flow
- [x] Rate limiting on auth endpoints — implemented via `express-rate-limit` (10 req/min/IP for signup/login)
- [ ] Task status is a free string — no enforced enum or workflow
- [ ] No pagination on `projects` or `tasks` queries

## UX / Product

- [ ] Task ordering / drag-and-drop within backlog sections
- [ ] Due dates on tasks (sprint start/end dates exist, per-task dates not yet)
- [x] Task assignment to users — implemented via `assigneeId` + `orgUsers` query
- [x] Skeleton loading states for task lists and kanban boards
- [x] Step-by-step progress indicator for AI task plan generation
- [x] Input blocking during AI generation (all controls disabled)
- [x] Navigation/tab-close warning during generation with request cancellation (AbortController)
- [x] Status ↔ kanban column bidirectional sync (changing status moves card, dragging card updates status)
- [x] Removed "Expand to subtasks" button from task detail panel
- [ ] Project archiving
- [ ] Org member invite flow (currently only `createOrg` adds a user)
- [ ] Sprint editing (rename, change columns, adjust dates) — only create/delete/activate exist
- [ ] Delete sprint UI (no delete button in BacklogView yet)
- [ ] Drag tasks between sprint sections in BacklogView (currently must use TaskDetailPanel sprint select)
- [ ] Sprint velocity / burn-down metrics

## Technical Debt

- [ ] Shared types between API and web — currently duplicated in `apps/web/src/types.ts`
  - `packages/shared` was removed; could be reintroduced or use graphql-codegen
- [ ] Error handling in resolvers is minimal — GraphQL errors could be more structured
- [ ] No structured logging (only console.error) — consider pino
- [ ] Monolithic schema.ts (901+ lines) — split into domain-specific resolver modules
- [ ] ProjectDetail.tsx is a god component (657 lines, 23 useState) — extract custom hooks
- [ ] Sprint.columns, Task.dependsOn, Task.suggestedTools stored as JSON strings — use Prisma Json type
- [ ] Task.dependsOn uses title strings instead of IDs — fragile if titles change

## Infrastructure

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker Compose for local dev (API + Postgres together)
- [ ] Production deployment (Railway, Render, or Fly.io are good fits)
- [ ] Environment-based config validation (zod for env vars)
