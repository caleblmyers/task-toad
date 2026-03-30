# TaskToad — Remaining Work

75 swarm waves + pipeline hardening. First end-to-end pipeline test completed 2026-03-27. Pipeline mechanics work; cross-task coherence is the critical gap. See `pipeline-analysis-2026-03-27.md`.

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
- [x] **Session time limit enforcement** — check `timeLimitMinutes` alongside budget/scope checks. *(Wave 73)*
- [x] **Session resume edge cases** — cleans up archived/deleted tasks, clears autoComplete on removed tasks. *(Wave 73)*
- [x] **Rate limiting for completionSummary generation** — budget check added before summary AI call, skips with warning when exhausted. *(Wave 72)*
- [x] **verify_build retry/polling for in-progress checks** — polls every 30s, max 20 attempts, uses 'polling' status pattern. *(Wave 73)*
- [x] **Session planning: commitSprintPlan compatibility** — assigns tasks to existing active sprint for single-session plans. *(Wave 73)*
- [x] **Reconciliation task: link back to sprint** — assigned to next sprint with description referencing source sprint. *(Wave 73)*

---

## Bootstrap Flow Redesign

- [x] Fix race condition: GitHub repo modal guarded by `isDialogActive` flag *(Wave 71)*
- [x] Plan generation UX: skeleton cards + progress messages in HierarchicalPlanDialog *(Wave 71)*
- [x] Default to backlog view after project creation *(Wave 71)*
- [x] **Single project interpretation** — prompt updated in `generation.ts`, dead `projectOptions.ts` removed *(post-Wave 71 fix)*
- [ ] Replace stacked modals with single-panel wizard (step 1 of N) — lower priority, current flow works with modal guard fix

---

## UX

- [x] Chat actions: input validation for applyChatAction *(Wave 73)*
- [x] Chat actions: activity log entries when tasks created/updated via chat *(Wave 73)*
- [x] WhatNextPanel: refresh button after applying actions *(Wave 73)*
- [x] ProjectChatPanel: wire `onSelectTask` prop from ProjectDetail, clickable task references *(Wave 73)*
- [x] Long-running AI operations: descriptive loading messages per stage *(Wave 73)*
- [x] Sprints: first auto-activates on creation *(Wave 73)*
- [x] Close sprint: offer "create new sprint" option *(Wave 73)*
- [x] Sprint creation: pass `previousSprint` prop from close sprint flow for auto-populated defaults *(Wave 75)*
- [x] Sprint columns: reorderable *(Wave 74)*
- [ ] Release notes: manual entry option
- [ ] Time entry deletion: admin-only
- [ ] Mobile: horizontal scrolling on project page
- [x] Automation comments: system/bot attribution *(Wave 74)*
- [x] Priority dropdown: color coding *(Wave 74)*
- [x] SSE cross-tab sync *(Wave 75)*
- [x] Column reorder: wire `onReorderColumns` callback in ProjectDetail to call `updateSprint` mutation *(Wave 75)*
- [x] Priority color: add colored option backgrounds to the priority `<select>` dropdown (currently only dot + text color) *(Wave 75)*
- [x] Branch cleanup: also delete branches on plan cancellation (currently only on successful merge) *(Wave 75)*
- [ ] SSE leader election: add keyboard accessibility to PriorityDropdown (arrow keys, Escape to close)
- [ ] SSE cross-tab: consider adding a leader tab indicator in dev mode for debugging
- [ ] Branch cleanup on session timeout — currently only handles explicit cancellation, not `timeLimitMinutes` expiry

---

## Code Quality & Testing

- [x] Fix 3 pre-existing test failures in `insightGeneration.test.ts` — missing mock methods *(pre-Wave 72 fix)*
- [x] Integration test DB isolation (session_replication_role, settle delay) *(Wave 74)*
- [x] Integration test for branch flow (6 tests, mock GitHub API) *(Wave 74)*
- [x] Test coverage for sessions (CRUD, orchestration, budget/scope, failure policy) — 24 integration tests *(pre-Wave 75)*
- [x] Test coverage for context threading (previousStepContext, upstream summaries, failure context) — 18 integration tests *(pre-Wave 75)*
- [ ] Test coverage for fix_review (approved skip, AI fixes with source, deferred tasks, duplicate detection)
- [ ] Integration test for logout→login-as-different-user flow
- [ ] merge-worker.sh: auto-detect lockfile changes

---

## Refactors

- [ ] **Split useProjectData** — 100+ properties → focused sub-interfaces
- [ ] **Resolver auth guards** — `requireEntity<T>()` helper, do incrementally
- [ ] **AI feature registry** — consolidate 40+ wrapper functions in aiService.ts
- [ ] **Extract insight generation to event listeners** — move from actionExecutor to async event-driven pattern
- [x] **replanFailedTask shared helper** — `createPlanWithActions` in `planHelpers.ts` *(Wave 74)*
- [x] **Branch cleanup strategy** — auto-delete after successful merge_pr *(Wave 74)*
- [x] **Audit executor config Zod validation** — manual_step and monitor_ci now have schemas *(Wave 74)*

---

## Future

- [ ] Stripe integration for billing
- [x] Custom domain — `tasktoad.app` registered on Cloudflare, DNS pointed to Railway *(2026-03-30)*
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
| 73 | 2026-03-28 | Follow-ups + UX: verify_build polling, session time/resume, chat validation/logging, sprint auto-activate, AI loading states |
| 74 | 2026-03-28 | Quality + UX + refactors: test DB isolation, branch flow tests, priority colors, automation bot, column reorder, branch cleanup, Zod audit, planHelpers extraction |
| 75 | 2026-03-30 | Column reorder wiring, sprint close→create flow, branch cleanup on cancel, SSE cross-tab sync, priority select colors |

Full wave details in `changelog.md`.
