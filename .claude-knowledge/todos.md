# Deferred Ideas & Future Improvements

Organized into **Task Sets** for parallel swarm development. Completed items are in `changelog.md`.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Priority Order

1. **Q1** — Code quality & testing (authz regression tests, e2e suite, password policy alignment)
2. **D1** — Deployment & observability (object storage for attachments, metrics wiring)
3. **F1** — Frontend performance & architecture (ProjectDetail decomposition)
4. **A11** — Accessibility
5. **W2** — Advanced tasks & filters
6. **I1** — Integration completeness
7. **S1** — Styling & branding
8. **W6** — AI extras
9. **SW1** — Swarm workflow optimization

---

## Remaining Work

### Q1: Code Quality & Testing
**Touches:** `apps/web/src/hooks/`, `apps/api/src/__tests__/`
- [x] ~~TypeScript strictness — remaining `any` types audit~~ — done in Wave 18
- [x] ~~Expand test coverage — useTaskCRUD hook tests, web component tests~~ — done in Wave 18 (useTaskCRUD + ActivityFeed)
- [x] ~~Recurrence scheduler tests~~ — done in Wave 17
- [x] ~~Attachment DataLoader~~ — done in Wave 17
- [x] ~~Authorization regression tests~~ — done in Wave 17 (7 boundary tests)
- [x] ~~End-to-end test suite~~ — done in Wave 19 (happy-path + task lifecycle + tenant isolation)
- [x] ~~Fix integration test DB~~ — done in Wave 18 (fixed table names + password validation)
- [x] ~~Password policy alignment~~ — done in Wave 17 (shared validatePassword, client-side validation)

### A11: Accessibility
**Touches:** `apps/web/src/components/`
- [x] ~~Color contrast audit — full WCAG AA 4.5:1 audit of all Tailwind color pairings~~ — done in Wave 20 (text-slate-400→500, text-slate-500→700 on bg-slate-100)

### W2: Advanced Tasks & Filters
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/task.ts`, frontend
- [x] ~~Shared types between API and web~~ — done in Wave 19 (@tasktoad/shared-types workspace package)

### W6: AI Extras
**Touches:** `resolvers/ai.ts`, `apps/web/src/components/`
- [x] ~~SDL descriptions for remaining operations~~ — done in Wave 17 (github, report, slack, webhook, projectrole)
- [x] ~~Subtask code gen abort support~~ — done in Wave 17 (AbortController + Cancel button)
- [x] ~~AI prompt log admin toggle~~ — done in Wave 17 (promptLoggingEnabled on Org, OrgSettings toggle)
- [x] ~~Thread promptLoggingEnabled through AI callers~~ — done in Wave 18

### D1: Deployment & Observability
**Touches:** `apps/api/src/app.ts`, `apps/api/src/index.ts`, Railway config
- [x] ~~External uptime monitoring (Uptime Robot or similar)~~ — documented in Wave 21 (decisions.md)
- [x] ~~Railway alerting — restart loops, memory spikes, high CPU~~ — documented in Wave 21 (decisions.md)
- [x] ~~Staging environment — Railway preview deployments from PRs~~ — documented in Wave 21 (decisions.md)
- [x] ~~Database backup strategy — verify Railway automated backups, document restore~~ — documented in Wave 21 (decisions.md)
- [x] ~~Wire Prometheus resolver duration metrics~~ — done in Wave 17 (yoga plugin + Prisma pool interval)
- [x] ~~Enable Railway deploy webhook in GitHub Actions~~ — done in Wave 17 (conditional deploy + smoke test job)
- [x] ~~Object storage for attachments — migrate from local disk to S3/R2~~ — done in Wave 20 (S3 with local fallback, health check, presigned URLs)

### I1: Integration Completeness
**Touches:** `apps/api/src/utils/webhookDispatcher.ts`, `apps/api/src/slack/`, `apps/api/src/github/`
- [x] ~~Slack user mapping discovery — `/tasktoad link` self-service command~~ — done in Wave 18
- [x] ~~GitHub webhook retry — dead letter queue for failed webhook processing~~ — done in Wave 18

### F1: Frontend Performance & Architecture
**Touches:** `apps/web/src/components/`, `apps/web/src/pages/`, `apps/web/src/hooks/`
- [x] ~~Virtualize activity feeds~~ — done in Wave 18 (react-window ActivityFeed + paginated CommentSection)
- [x] ~~Dark mode contrast audit — verify dark: color pairings meet WCAG AA 4.5:1~~ — done in Wave 21 (slate-400→300/200 across TaskDetailPanel, Button, GlobalSearchModal, ProjectDetail)
- [x] ~~Decompose ProjectDetail + useProjectData~~ — done in Wave 18 (extracted ProjectToolbar, consolidated modal state)

### S1: Styling & Branding
**Touches:** `apps/web/src/components/shared/`, `apps/web/tailwind.config.js`
- [x] ~~Consistent spacing/typography scale — audit and normalize across components~~ — done in Wave 20 (TaskDetailPanel, Projects, BacklogView)
- [x] ~~SVG favicon~~ — done in Wave 19 (frog silhouette SVG + PNG fallback)
- [x] ~~Social preview meta tags~~ — done in Wave 19 (og:image, og:title, twitter:card)
- [x] ~~PWA service worker — offline caching via workbox~~ — done in Wave 20 (vite-plugin-pwa, NetworkFirst API cache, autoUpdate)
- [x] ~~Dark mode for remaining modals~~ — done in Wave 19 (all 12 modals)

### Misc Follow-ups
- [x] ~~Review `schema.ts` change — `'tasks'` added to `SINGLE_OBJECT_FIELDS`~~ — committed as fix(api) in e3006a3, was causing query cost 430K > 100K limit

### SW1: Swarm Workflow Optimization
**Touches:** `.claude/skills/`, `scripts/swarm/`
- [x] ~~Auto-prisma-generate in spawn.sh~~ — done in Wave 19 (runs per worktree)
- [x] ~~Task file array validation~~ — done in Wave 19 (validate-tasks.sh)
- [x] ~~Auto-strip worker role from CLAUDE.md~~ — done in Wave 19 (delimiter + sed strip in merge-worker.sh)

---

## Parallelism Matrix

**Safe parallel combos:**
- Q1 (tests) + I1 (integrations) + F1 (performance)
- W2 (tasks) + any non-W set
- S1 (styling) + D1 (deployment)

**Conflicts:**
- A11 + S1 (both touch component styling)

---

## Follow-ups from Wave 19

- [x] ~~Have API also import from `@tasktoad/shared-types` for resolver return type annotations~~ — done in Wave 20 (task.ts + project.ts re-exports)
- [x] ~~E2E tests: add export route handler test via supertest~~ — done in Wave 20 (5 tests: JSON, CSV, activity, auth, tenant isolation)
- [x] ~~E2E tests: add notification/SSE flow test coverage~~ — done in Wave 21 (notification resolver + SSE manager unit tests)
- [x] ~~Dark mode: verify dark mode contrast meets WCAG AA~~ — done in Wave 21
- [x] ~~Social preview: create a proper composite og:image~~ — done in Wave 20 (1200x630 SVG with toad icon + brand colors)
- [ ] Task descriptions creating new workspace packages should note: point `types` to source (`src/index.ts`) not dist (learned from task-006 rejection)

## Follow-ups from Wave 20

- [x] ~~S3 upload tests — unit tests for S3 upload/download/delete with AWS SDK mocking~~ — done in Wave 21
- [x] ~~S3 presigned URL expiry configuration — make the 15-min default configurable via env var~~ — done in Wave 21 (ATTACHMENT_URL_EXPIRY_SECONDS)
- [x] ~~PWA offline fallback page — create `offline.html` with "You are offline" message for uncached routes~~ — done in Wave 21
- [ ] PWA cache invalidation strategy — document how to force SW update on breaking API changes
- [x] ~~og:image PNG fallback — some social platforms don't render SVG og:images~~ — done in Wave 21
- [x] ~~Export test rate limit handling — tenant isolation test hitting 429~~ — done in Wave 21 (rate limit relaxed in test env)
- [x] ~~Extend shared-types usage — expand to more resolvers and web client types~~ — done in Wave 21 (ProjectStats, TaskConnection, CloseSprintResult, SprintPlanItem moved; sprint resolver re-exports)
- [ ] S3 multipart upload — current 10MB limit uses single PUT; for larger files, implement multipart upload

## Follow-ups from Wave 21

- [ ] Dark mode contrast audit — remaining components not checked in Wave 21 (BacklogView, SprintCreateModal, KanbanBoard, etc.) may still have `dark:text-slate-400` on dark backgrounds
- [ ] Shared-types re-export in comment resolver — task-003 planned to add exports in `resolvers/comment.ts` but only did `resolvers/sprint.ts`; expand to more resolvers
- [ ] PWA navigateFallback behavior — verify offline.html is only served for navigation requests (not API/asset requests) in production; current denylist only covers `/api/`
- [ ] Pre-existing lint warnings — 8 warnings across BurndownChart, GanttChart, ProjectSettingsModal, TaskPlanApprovalDialog, Home, Projects; not blocking but should be cleaned up
- [ ] S3 unit tests don't cover `getFromS3` (if it exists) or error handling for `uploadToS3` failures (e.g., network timeout, bucket permissions)
