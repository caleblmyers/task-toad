# TaskToad — Remaining Work

70 swarm waves + pipeline hardening. First end-to-end pipeline test completed 2026-03-27. Pipeline mechanics work; cross-task coherence is the critical gap. See `pipeline-analysis-2026-03-27.md`.

---

## Autopilot Pipeline (Priority)

### Code Generation Coherence
- [ ] **R1: Fetch repo file contents in generateCode** (highest impact) — fetch key files (schema, package.json, types, routes) from GitHub repo and include in AI prompt as "Current Codebase" section. Cap context to avoid token limits.
- [ ] **R2: Schema-first constraint** — detect Prisma schema (or equivalent) in file tree, fetch contents, instruct AI to use exactly those models. Same for TypeScript type definitions.
- [ ] **R3: Richer cross-task context** — include file paths changed and key type/schema definitions in upstreamTaskContext, not just prose summaries. Consider fetching PR diff from most recent upstream task.
- [ ] **Decomposition quality** — tasks like "Set up API framework" are too broad (8 files, 6 review issues, 8 deferred). Add guidance to hierarchical plan prompt about maximum task scope per code generation pass.

### Pipeline Steps
- [ ] **R4: Post-merge build verification** — optional `verify_build` action after `merge_pr`. Run build command, create fix task on failure. Opt-in per project.
- [ ] **R5: Sprint close reconciliation** — on `closeSprint`, trigger consistency check (build, imports, types). Auto-generate reconciliation task through normal pipeline if issues found.
- [ ] **Deferred task context** — fix_review creates orphaned backlog items. Should: inherit parent epic, add dependency from source task, include PR/file references. AI should output structured metadata (epic, dependency type).
- [ ] **Optimize knowledge retrieval** — AI call on every action step is wasteful (5 per plan). Cache per task at plan start, or return all entries for small KBs.
- [ ] **Fix false stall detection** — "Resume" button appears during normal inter-step delays. Add ~30s grace period or track `lastActionCompletedAt` from SSE.
- [ ] **Auto-Complete button** — hide when action plan already exists. Show contextual state (progress/retry/results) instead.
- [ ] **Branch/commit naming** — descriptive text first, short ID suffix last. `configure-database-schema-3b03af` not `task-UUID-slug`. See `githubCommitService.ts`.

### Sessions & Orchestration
- [ ] **Evolve "AI Plan Sprint" into session planning** — generate coherent execution batches (3-5 related tasks, dependency-ordered) instead of distributing whole backlog into time-boxed sprints. Natural entry point for Session concept.
- [ ] **Session progress: track token usage and cost** — wire AI usage tracking into session progress.
- [ ] **Session time limit enforcement** — check `timeLimitMinutes` alongside budget/scope checks.
- [ ] **Session resume edge cases** — handle `autoComplete` flag when tasks removed from session.
- [ ] **Rate limiting for completionSummary generation** — consider caching or skipping if budget exhausted.

---

## Bootstrap Flow Redesign

- [ ] **Single redesign** covering related issues:
  - Fix race condition: GitHub repo modal appears behind review plan modal
  - Replace 3-option project flow with single best interpretation + refinement
  - Replace stacked modals with single-panel wizard (step 1 of N)
  - Plan generation UX: two-pass (epics first, then tasks fill in) or skeleton indicators
- [ ] Default to backlog view after project creation

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

Full wave details in `changelog.md`.
