# TaskToad — Remaining Work

70 swarm waves + pipeline hardening. First end-to-end pipeline test completed 2026-03-27. Pipeline mechanics work; cross-task coherence is the critical gap. See `pipeline-analysis-2026-03-27.md`.

---

## Autopilot Pipeline (Priority)

### Code Generation Coherence
- [x] **R1: Fetch repo file contents in generateCode** — wired `resolveCodeGenContext()` into executor, passes `repoContext` to AI *(Wave 71)*
- [x] **R2: Schema-first constraint** — detects Prisma schema and type definitions, adds "use exactly these models" instruction *(Wave 71)*
- [x] **R3: Richer cross-task context** — `upstreamTaskContext` includes `filesChanged` bullet lists and `apiContracts` unconditionally *(Wave 71)*
- [x] **Decomposition quality** — rule 10 in hierarchical plan prompt: 3-8 files max per task *(Wave 71)*

### Pipeline Steps
- [x] **R4: Post-merge build verification** — `verify_build` executor checks CI status on default branch after merge, skips gracefully when no CI configured. Registered in action types, Zod schema, and planning prompt as optional post-merge step. *(Wave 72)*
- [x] **R5: Sprint close reconciliation** — `closeSprint` checks CI on default branch, auto-creates high-priority reconciliation task with `autoComplete: true` on failure, shows status in close modal. *(Wave 72)*
- [x] **Deferred task context** — inherits parent epic, `informs` dependency, PR number in description *(Wave 71)*
- [x] **Optimize knowledge retrieval** — cached per planId, threshold raised to 10 entries *(Wave 71)*
- [x] **Fix false stall detection** — 30s grace period before showing Resume button *(Wave 71)*
- [x] **Auto-Complete button** — hidden when action plan exists *(Wave 71)*
- [x] **Branch/commit naming** — `{slug}-{shortId}` format *(Wave 71)*

### Sessions & Orchestration
- [x] **Evolve "AI Plan Sprint" into session planning** — selects 3-5 coherent tasks with dependency awareness, rationale, and `maxTasks` parameter. Frontend updated with session labeling. *(Wave 72)*
- [x] **Session progress: track token usage and cost** — aggregates from AIPromptLog, atomic jsonb_set update. *(Wave 72)*
- [ ] **Session time limit enforcement** — check `timeLimitMinutes` alongside budget/scope checks.
- [ ] **Session resume edge cases** — `startSession` allows re-starting paused sessions but doesn't un-set `autoComplete` on tasks removed from the session. Consider edge cases around task membership changes.
- [x] **Rate limiting for completionSummary generation** — budget check added before summary AI call, skips with warning when exhausted. *(Wave 72)*
- [ ] **verify_build retry/polling for in-progress checks** — currently returns "pending" if checks are still running; could poll with backoff or retry after a delay.
- [ ] **Session planning: commitSprintPlan compatibility** — `commitSprintPlan` resolver wasn't updated to match session-style planning; verify it works correctly with single-session plans.
- [ ] **Reconciliation task: link back to sprint** — auto-created reconciliation tasks aren't linked to the sprint that triggered them; could add a `triggeredBySprintId` or use a label.

---

## Bootstrap Flow Redesign

- [x] Fix race condition: GitHub repo modal guarded by `isDialogActive` flag *(Wave 71)*
- [x] Plan generation UX: skeleton cards + progress messages in HierarchicalPlanDialog *(Wave 71)*
- [x] Default to backlog view after project creation *(Wave 71)*
- [x] **Single project interpretation** — prompt updated in `generation.ts`, dead `projectOptions.ts` removed *(post-Wave 71 fix)*
- [ ] Replace stacked modals with single-panel wizard (step 1 of N) — lower priority, current flow works with modal guard fix

---

## UX

- [ ] Chat actions: input validation for applyChatAction
- [ ] Chat actions: activity log entries when tasks created/updated via chat
- [ ] WhatNextPanel: refresh button after applying actions
- [ ] ProjectChatPanel: wire `onSelectTask` prop from ProjectDetail
- [ ] Long-running AI operations: better loading states
- [ ] Sprints: ordered, first auto-activates
- [ ] Close sprint: offer "create new sprint" option
- [ ] Sprint columns: reorderable
- [ ] Release notes: manual entry option
- [ ] Time entry deletion: admin-only
- [ ] Mobile: horizontal scrolling on project page
- [ ] Automation comments: system/bot attribution
- [ ] Priority dropdown: color coding
- [ ] SSE cross-tab sync

---

## Code Quality & Testing

- [ ] Fix 3 pre-existing test failures in `insightGeneration.test.ts` — failing on main before Wave 71, likely due to actionExecutor changes in pipeline hardening session
- [ ] Integration test DB isolation (10 files, 23 tests, FK violations) — blocks `pnpm test` as merge gate
- [ ] Integration test for branch flow (~5 tests, mock GitHub API)
- [ ] Test coverage for sessions (CRUD, orchestration, budget/scope, failure policy)
- [ ] Test coverage for context threading (previousStepContext, upstream summaries, failure context)
- [ ] Test coverage for fix_review (approved skip, AI fixes with source, deferred tasks, duplicate detection)
- [ ] Integration test for logout→login-as-different-user flow
- [ ] merge-worker.sh: auto-detect lockfile changes

---

## Refactors

- [ ] **Split useProjectData** — 100+ properties → focused sub-interfaces
- [ ] **Resolver auth guards** — `requireEntity<T>()` helper, do incrementally
- [ ] **AI feature registry** — consolidate 40+ wrapper functions in aiService.ts
- [ ] **Extract insight generation to event listeners** — move from actionExecutor to async event-driven pattern
- [ ] **replanFailedTask shared helper** — extract duplicated plan creation + ID remapping logic
- [ ] **Branch cleanup strategy** — auto-delete failed/cancelled plan branches
- [ ] **Audit executor config Zod validation** — verify manual_step and monitor_ci have schemas

---

## Future

- [ ] Stripe integration for billing
- [ ] Custom domain
- [ ] Scheduled report delivery (depends on SMTP)
- [ ] License gating test coverage

---

## Manual Testing

- [ ] Verify concurrent plan execution doesn't corrupt branch state
- [ ] Verify failed plan leaves branch in recoverable state

---

## Completed Waves

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
| 45 | 2026-03-21 | P1 features (SLA, multi-action automation, compound conditions) |
| 46 | 2026-03-21 | Code quality, unit tests, P2 (Monte Carlo, cron automation) |
| 47 | 2026-03-21 | P2 (cycle time scatter, release burndown, auto-tracking, workload heatmap) |
| 48 | 2026-03-21 | P2 (timesheet view, approval workflows) |
| 49 | 2026-03-21 | P2 (initiatives, workflow permissions, field-level restrictions) |
| 50 | 2026-03-21 | TQL parser, follow-up fixes |
| 51 | 2026-03-21 | Feature polish, reliability, shared types |
| 52 | 2026-03-22 | Final cleanup: SLA business hours, reliability, test stability |
| 53 | 2026-03-22 | Bug fixes: PWA, feature cuts, archived tasks, automation |
| 54 | 2026-03-22 | Must-fix UX: priority, AI permissions, dependencies, epics |
| 55 | 2026-03-22 | Should-fix UX: modal, auto-track, TQL, automation, SSE |
| 56 | 2026-03-23 | Bug fixes: priority, workflow, saved views, release, auth |
| 57 | 2026-03-23 | Open core: license flag system, premium gating |
| 58 | 2026-03-24 | Project scaffolding: wizard, scaffold mutation, templates |
| 59 | 2026-03-24 | Per-org licensing: plan column, license.ts rewrite |
| 60 | 2026-03-24 | Scaffolding + licensing follow-ups |
| 61 | 2026-03-25 | Pre-pipeline refactors: token manager, event helpers |
| 62 | 2026-03-25 | Deferred refactors: hooks, tabs, pickers, metrics, charts |
| 63 | 2026-03-25 | Quick hits: closed-source cleanup, modal dismiss, session security |
| 64 | 2026-03-26 | Phase 1: branch-based pipeline |
| 65 | 2026-03-26 | Phase 1 follow-ups: error handling, OAuth routing, fix_review |
| 66 | 2026-03-26 | Phase 1.5: AI stack recommendations, scaffold config, onboarding |
| 67 | 2026-03-26 | Phase 2: context threading |
| 68 | 2026-03-26 | Phase 3: orchestration — sessions, re-planning |
| 69 | 2026-03-26 | Follow-up cleanup |
| 70 | 2026-03-27 | Actionable AI: projectChat actions, whatNext, dependency inference |
| — | 2026-03-27 | Pipeline hardening: SSE fix, merge_pr, 401 retry, fix_review overhaul |
| 71 | 2026-03-28 | Code gen coherence: repo context, schema-first, decomposition, stall detection, branch naming, KB caching, bootstrap fixes |
| 72 | 2026-03-28 | Pipeline reliability: verify_build action, sprint close reconciliation, session planning, session progress tracking |
| 71 | 2026-03-28 | Code gen coherence: repo context in generateCode, schema-first constraint, decomposition quality, stall detection, branch naming, KB caching, deferred task context, bootstrap fixes |

Full wave details in `changelog.md`.
