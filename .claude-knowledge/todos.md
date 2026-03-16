# Deferred Ideas & Future Improvements

Organized into **Task Sets** for parallel swarm development. Completed items are in `changelog.md`.

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Priority Order

1. **Q1** — Code quality & testing (authz regression tests, e2e suite)
2. **A11** — Accessibility
3. **W2** — Advanced tasks & filters
4. **I1 + D1** — Integration completeness & observability
5. **F1** — Frontend performance
6. **S1** — Styling & branding
7. **W6** — AI extras
8. **SW1** — Swarm workflow optimization

---

## Remaining Work

### Q1: Code Quality & Testing
**Touches:** `apps/web/src/hooks/`, `apps/api/src/__tests__/`
- [ ] TypeScript strictness — remaining `any` types audit
- [ ] Expand test coverage — useTaskCRUD hook tests, web component tests
- [ ] Recurrence scheduler tests — unit tests for cron matching logic, processRecurrence edge cases
- [ ] Attachment DataLoader — Task.attachments does individual DB query per task; add to loaders.ts
- [ ] **Authorization regression tests** — test all multi-tenant boundary checks added in production hardening (cross-org assignment, cross-project custom fields, cross-tenant comment deletion, automation assign_to org validation)
- [ ] **End-to-end test suite** — basic happy-path flows (signup → create org → create project → create/update task → assign → comment → export)

### A11: Accessibility
**Touches:** `apps/web/src/components/`
- [ ] Color contrast audit — full WCAG AA 4.5:1 audit of all Tailwind color pairings

### W2: Advanced Tasks & Filters
**Touches:** `prisma/schema/task.prisma`, `typedefs/task.ts`, `resolvers/task.ts`, frontend
- [ ] Shared types between API and web — evaluate graphql-codegen or shared package

### W6: AI Extras
**Touches:** `resolvers/ai.ts`, `apps/web/src/components/`
- [ ] SDL descriptions for remaining ~30 operations (github, report, slack, webhook, projectrole)
- [ ] Subtask code gen abort support — CodePreviewModal subtask generation lacks AbortController
- [ ] AI prompt log admin toggle — per-org setting to disable prompt logging entirely

### D1: Deployment & Observability
**Touches:** `apps/api/src/app.ts`, `apps/api/src/index.ts`, Railway config
- [ ] External uptime monitoring (Uptime Robot or similar)
- [ ] Railway alerting — restart loops, memory spikes, high CPU
- [ ] Staging environment — Railway preview deployments from PRs
- [ ] Database backup strategy — verify Railway automated backups, document restore
- [ ] Wire Prometheus resolver duration metrics — some paths don't emit `graphql_resolver_duration`
- [ ] Enable Railway deploy webhook in GitHub Actions (uncomment in deploy.yml)

### I1: Integration Completeness
**Touches:** `apps/api/src/utils/webhookDispatcher.ts`, `apps/api/src/slack/`, `apps/api/src/github/`
- [ ] Slack user mapping discovery — `/tasktoad link` self-service command
- [ ] GitHub webhook retry — dead letter queue for failed webhook processing

### F1: Frontend Performance
**Touches:** `apps/web/src/components/`
- [ ] Virtualize activity feeds — react-window for activity/comment feeds when > 100 items
- [ ] Dark mode contrast audit — verify dark: color pairings meet WCAG AA 4.5:1

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
