# TaskToad — Remaining Work & Tracking

62 swarm waves completed. 349 tests. **Strategic pivot to closed-source SaaS autopilot — building the three pillars (decomposition, context threading, orchestration).**

**Current focus: Phase 1 — Pipeline rewrite (branch-based execution).** See `autopilot-pillars.md` for the full spec.

---

## Quick Hits (before Phase 1)

- [ ] Replace `LICENSE` file — remove AGPL-3.0, add proprietary license text
- [ ] Remove or rewrite `CONTRIBUTING.md` for closed source
- [ ] Remove `TASKTOAD_LICENSE` env var and self-host override code (or repurpose for enterprise tier)
- [ ] Remove Docker self-hosting config if still present (`docker-compose` deploy profile)
- [ ] Project bootstrap modals should not be dismissable by clicking outside during an active process

## Investigate

- [ ] **Session / cross-account data leak** — when session expires and user logs in as a different account, could frontend React state serve data from the previous account? Logout should clear all state. Potential security issue.

---

## Phase 1: Pipeline Rewrite — Branch-Based Code Generation

See `autopilot-pillars.md` for the full phase roadmap and spec.

**Implementation tasks (5 vertical slices):**

1. **Branch management in actionExecutor.ts** (~45 min)
   - Create feature branch when plan starts executing
   - Store `branchName` and `headOid` on `TaskActionPlan` model (new fields, migration needed)
   - Pass branch context to executors via `ActionContext`
   - For personal GitHub accounts, pass user's OAuth token
   - **Fold in R10:** Extract side effects (insight generation, in_review transition) into event listeners
   - **Fold in R13:** Add Zod config validation for executor configs
   - Files: `actionExecutor.ts`, `actions/types.ts`, prisma schema, migration

2. **Update generateCode executor to commit** (~45 min)
   - Commit generated files to feature branch after AI generation
   - Update `headOid` on plan after each commit
   - Read feature branch file tree (not main) for context
   - **Fold in R13:** Zod schema for GenerateCodeConfig
   - Files: `executors/generateCode.ts`, `actionExecutor.ts`

3. **Update writeDocs executor to commit** (~30 min)
   - Same commit pattern as generateCode
   - **Fold in R13:** Zod schema for WriteDocsConfig
   - Files: `executors/writeDocs.ts`

4. **Update createPR executor to use existing branch** (~30 min)
   - Open PR from feature branch to default branch (no file creation)
   - Read branch name from plan context
   - **Fold in R13:** Zod schema for CreatePRConfig
   - Files: `executors/createPR.ts`

5. **Fix planner + improve review_pr** (~30 min)
   - Always include `create_pr` + `review_pr` for connected repos (enforce in code)
   - Update prompt: tasks should be generic, not vendor-specific
   - Improve `review_pr` to act as skeptical reviewer (security, standards)
   - Files: `resolvers/taskaction.ts`, `promptBuilders/planning.ts`

**Parallelism:** Tasks 1+5 parallel. Tasks 2+3 depend on 1. Task 4 depends on 2.

**After Phase 1:** Manual end-to-end test (new project → scaffold → task → auto-complete → PR on GitHub).

---

## Post-Phase 1 Backlog

### Remaining Refactors
- **R5: Split useProjectData** — 100+ properties → focused sub-interfaces. P2.
- **R7: Resolver auth guards** — `requireEntity<T>()` helper. P3. Do incrementally.
- **R3: AI feature registry** — consolidate 40+ wrapper functions in aiService.ts. Do if touching file.

### UX Improvements
- [ ] Long-running AI operations need better loading states (descriptive, not just spinner)
- [ ] Network latency during project init — show per-step progress
- [ ] Sprints should be ordered; first sprint should auto-activate
- [ ] Close sprint should offer "create new sprint" option
- [ ] Sprint columns should be reorderable
- [ ] Release notes should have manual entry option
- [ ] Time entry deletion should be admin-only action
- [ ] Mobile: horizontal scrolling messy on project page
- [ ] Automation comments should not be attributed to a user (use system/bot)
- [ ] Priority dropdown: color coding (red for critical, orange for high)
- [ ] SSE cross-tab sync

### Code Quality
- [ ] Fix integration test DB isolation (10 files, 23 tests, FK constraint violations) — blocks `pnpm test` as merge gate
- [ ] Fix React act() warnings in ProjectSetupWizard tests
- [ ] merge-worker.sh: auto-detect lockfile changes and run pnpm install before validation

### Feature Requests
- [ ] Stripe integration for billing (Plans tab has placeholder)
- [ ] Custom domain
- [ ] Scheduled report delivery (depends on SMTP)
- [ ] License gating test coverage

---

## Completed Waves (Summary)

| Wave | Date | Focus |
|------|------|-------|
| 28 | 2026-03-18 | Codebase cleanup (dead code, decomposition, hooks) |
| 29 | 2026-03-18 | Dependency graph, cycle time metrics, useFormState |
| 30 | 2026-03-18 | Server-side filtering, workflow transitions, kanban swimlanes |
| 31 | 2026-03-19 | Task watchers, WIP limits, release model |
| 32 | 2026-03-20 | Cumulative flow, time tracking, saved views |
| 33 | 2026-03-20 | Multi-level hierarchy, user capacity, compound filters |
| 34 | 2026-03-20 | Query centralization, ARIA/TaskDetail tabs, permission scheme |
| 35 | 2026-03-20 | Critical security fixes (C-1 through C-5, H-5/H-7/H-8/H-11) |
| 36-41 | 2026-03-20 | Auto-Complete Pipeline Redesign (KB, planning, execution, insights, dashboard) |
| 42 | 2026-03-21 | Security Phase 2 — Auth Hardening (all 8 High items) |
| 43 | 2026-03-21 | Security Phase 3+4 — 9 Medium + 6 Low fixes |
| 44 | 2026-03-21 | Security cleanup, integration tests, auth follow-ups, frontend polish |
| 45 | 2026-03-21 | P1 features (SLA, multi-action automation, compound conditions), L-5 session limit, backend+frontend polish |
| 46 | 2026-03-21 | Code quality, unit tests (3 suites), P2 (Monte Carlo forecasting, cron automation) |
| 47 | 2026-03-21 | P2 (cycle time scatter, release burndown, auto-tracking, workload heatmap), polish batch |
| 48 | 2026-03-21 | P2 (timesheet view, approval workflows), follow-up polish |
| 49 | 2026-03-21 | P2 (initiatives, workflow permissions, field-level restrictions), polish |
| 50 | 2026-03-21 | TQL parser, follow-up fixes (field permissions, initiative, approval, timesheet) |
| 51 | 2026-03-21 | Feature polish, reliability, shared types, orchestrator metrics |
| 52 | 2026-03-22 | Final cleanup: SLA business hours, reliability, test stability |
| 53 | 2026-03-22 | Bug fixes: PWA offline page, V1 feature cuts, archived tasks, @mention, saved views, automation |
| 54 | 2026-03-22 | Must-fix UX: priority dropdown, AI permissions, dependency direction, epics GraphQL |
| 55 | 2026-03-22 | Should-fix UX: centered modal, auto-track clarity, TQL values, automation editing, SSE, saved views, epics |
| 56 | 2026-03-23 | Bug fixes: priority persistence, workflow restriction model, saved view filters, release burndown, silent auth, release layout, share toggle |
| 57 | 2026-03-23 | Open core: license flag system (TASKTOAD_LICENSE), premium feature gating (8 features), frontend useLicenseFeatures hook |
| 58 | 2026-03-24 | Project scaffolding: setup wizard, scaffold mutation, AI prompt fix, empty repo commit, framework templates |
| 59 | 2026-03-24 | Per-org licensing: plan column on Org, license.ts rewrite, 33 resolver call sites, infrastructure per-event checks |
| 60 | 2026-03-24 | Scaffolding + licensing follow-ups (default branch, template registry, KB auto-populate, wizard tests, orgPlan, Plans tab) |
| 61 | 2026-03-25 | Pre-pipeline refactors: token manager (R1), event helpers (R4), unused exports (R14), custom project option |
| 62 | 2026-03-25 | Deferred refactors: useEditableField (R2), tab extraction (R8), picker consolidation (R9), metrics (R6), queries split (R11), chart utilities (R12) |

Full wave details in `changelog.md`.
