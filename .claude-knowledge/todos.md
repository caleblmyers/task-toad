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
- [ ] TypeScript strictness — remaining `any` types audit
- [ ] Expand test coverage — useTaskCRUD hook tests, web component tests
- [x] ~~Recurrence scheduler tests~~ — done in Wave 17
- [x] ~~Attachment DataLoader~~ — done in Wave 17
- [x] ~~Authorization regression tests~~ — done in Wave 17 (7 boundary tests)
- [ ] **End-to-end test suite** — basic happy-path flows (signup → create org → create project → create/update task → assign → comment → export)
- [ ] Fix integration test DB — `Activity` table missing from test database; cleanDatabase truncate fails for all integration tests
- [x] ~~Password policy alignment~~ — done in Wave 17 (shared validatePassword, client-side validation)

### A11: Accessibility
**Touches:** `apps/web/src/components/`
- [ ] Color contrast audit — full WCAG AA 4.5:1 audit of all Tailwind color pairings

### W2: Advanced Tasks & Filters
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/task.ts`, frontend
- [ ] Shared types between API and web — evaluate graphql-codegen or shared package

### W6: AI Extras
**Touches:** `resolvers/ai.ts`, `apps/web/src/components/`
- [x] ~~SDL descriptions for remaining operations~~ — done in Wave 17 (github, report, slack, webhook, projectrole)
- [x] ~~Subtask code gen abort support~~ — done in Wave 17 (AbortController + Cancel button)
- [x] ~~AI prompt log admin toggle~~ — done in Wave 17 (promptLoggingEnabled on Org, OrgSettings toggle)
- [ ] Thread promptLoggingEnabled through AI callers — aiService.ts callAI calls don't pass promptLogContext; need to pass org.promptLoggingEnabled when logging is wired

### D1: Deployment & Observability
**Touches:** `apps/api/src/app.ts`, `apps/api/src/index.ts`, Railway config
- [ ] External uptime monitoring (Uptime Robot or similar)
- [ ] Railway alerting — restart loops, memory spikes, high CPU
- [ ] Staging environment — Railway preview deployments from PRs
- [ ] Database backup strategy — verify Railway automated backups, document restore
- [x] ~~Wire Prometheus resolver duration metrics~~ — done in Wave 17 (yoga plugin + Prisma pool interval)
- [x] ~~Enable Railway deploy webhook in GitHub Actions~~ — done in Wave 17 (conditional deploy + smoke test job)
- [ ] Object storage for attachments — migrate from local disk to S3/R2; current hardening (Content-Disposition, type validation) is interim only

### I1: Integration Completeness
**Touches:** `apps/api/src/utils/webhookDispatcher.ts`, `apps/api/src/slack/`, `apps/api/src/github/`
- [ ] Slack user mapping discovery — `/tasktoad link` self-service command
- [ ] GitHub webhook retry — dead letter queue for failed webhook processing

### F1: Frontend Performance & Architecture
**Touches:** `apps/web/src/components/`, `apps/web/src/pages/`, `apps/web/src/hooks/`
- [ ] Virtualize activity feeds — react-window for activity/comment feeds when > 100 items
- [ ] Dark mode contrast audit — verify dark: color pairings meet WCAG AA 4.5:1
- [ ] Decompose ProjectDetail + useProjectData — split into route-level feature modules or page controller + feature slices; introduce client-side query/cache layer (GPT audit finding #5)

### S1: Styling & Branding
**Touches:** `apps/web/src/components/shared/`, `apps/web/tailwind.config.js`
- [ ] Consistent spacing/typography scale — audit and normalize across components
- [ ] SVG favicon — proper SVG from T-Frog silhouette
- [ ] Social preview image — og:image composite
- [ ] PWA service worker — offline caching via workbox or custom SW
- [ ] Dark mode for remaining modals — BatchCodeGenModal, DriftAnalysisModal, etc.

### SW1: Swarm Workflow Optimization
**Touches:** `.claude/skills/`, `scripts/swarm/`
- [ ] Auto-prisma-generate in merge script — detect schema changes and run `npx prisma generate` before typecheck
- [ ] Task file array validation — pre-flight cross-reference of description file paths vs files array
- [ ] Auto-strip worker role from CLAUDE.md commits — .gitignore or pre-commit hook

---

## Parallelism Matrix

**Safe parallel combos:**
- Q1 (tests) + I1 (integrations) + F1 (performance)
- W2 (tasks) + any non-W set
- S1 (styling) + D1 (deployment)

**Conflicts:**
- A11 + S1 (both touch component styling)
