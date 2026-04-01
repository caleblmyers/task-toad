# TaskToad — Remaining Work

81 swarm waves complete. Production deployed on Railway at `tasktoad.app`. Pipeline mechanics work; launching as closed-source SaaS.

---

## Launch Blockers

- [ ] **Landing page polish** — current version is functional but needs professional design work
- [ ] **Test signup flow on prod** — verify Resend emails arrive, full signup→verify→login works
- [x] **Resend verification email from login page** — unauthenticated `requestVerificationEmail` mutation + login page resend button *(Wave 76)*
- [x] Custom domain — `tasktoad.app` registered on Cloudflare, DNS pointed to Railway *(2026-03-30)*
- [x] SMTP setup — Resend configured for transactional email *(2026-03-30)*
- [ ] Stripe integration for billing

---

## Bug Fixes

- [x] **Auto-Complete button text changes** — button now always shows 'Planning…' during loading *(Wave 77)*
- [x] **Commits attributed to user not bot** — removed user OAuth token override, installation token used for all commits *(Wave 77)*
- [x] **Kanban column overflow not scrollable** — added overflow-y-auto to column content wrapper *(Wave 77)*
- [x] **GitHub OAuth popup redirect** — popup navigates through github.com and loses `window.opener`, redirect to frontend callback page instead *(pre-Wave 77)*

---

## UX

- [x] PriorityDropdown: keyboard accessibility (arrow keys, Escape to close, ARIA attributes) *(Wave 76)*
- [x] **AI review comments collapsed by default** — comments collapsed, consistent with suggestions section *(Wave 77)*
- [x] **Close sprint/session from board view** — added 'Close Sprint' to board toolbar sprint dropdown *(Wave 77)*
- [ ] **Swimlane-specific overflow** — individual swimlane sections within a kanban column may need their own max-height + scroll if a single swimlane has many tasks, rather than relying solely on the column-level scroll
- [x] **Hierarchical plan progress events** — real SSE progress events replace fake cycling messages during plan generation *(Wave 78)*
- [ ] **Hierarchical plan streaming results** — stream partial results (epics first, then tasks per epic) instead of waiting for full response
- [x] **Scaffold generation progress events** — scaffoldProject emits ai.progress SSE events at each stage *(Wave 79)*
- [x] **Long user-facing flows need progress indicators** — bootstrap now emits ai.progress SSE events *(Wave 81)*
- [ ] Release notes: manual entry option
- [ ] Time entry deletion: admin-only
- [ ] Mobile: horizontal scrolling on project page
- [ ] Replace stacked modals with single-panel wizard (step 1 of N) — lower priority

---

## Pipeline

- [x] Branch cleanup on session timeout — `cancelSessionPlans()` shared helper handles timeout + budget cap *(Wave 76)*
- [x] **merge_pr executor: auto-update branch before merge** — `updatePullRequestBranch()` + auto-retry *(Wave 76)*
- [x] **merge_pr executor: detect already-merged PR** — `getPullRequestState()` check before merge *(Wave 76)*
- [x] **merge_pr executor: handle merge conflicts** — structured `errorReason` field *(Wave 76)*
- [x] **Concurrent action plan prevention** — backend guard in commitActionPlan/executeActionPlan + frontend button disabled when project busy *(Wave 78)*
- [x] **fix_review vague results** — stricter prompt with few-shot example, response normalization, and validation retry with error feedback in callAIStructured *(Wave 78)*
- [ ] **Concurrent plan check optimization** — `checkProjectBusy` in useAIGeneration makes two sequential API calls (executing + approved); combine into a single query that checks both statuses
- [ ] **Move fix_review normalization before Zod validation** — normalization in fixReview.ts runs after `callAIStructured` already validates, making it dead code. Move inside `callAIStructured` before `safeParse`, or expose raw response for pre-validation normalization
- [x] **Verify offloaded task quality** — fix_review prompt now requires specific titles, acceptance criteria, and severity guidelines; deferred tasks get instructions populated *(Wave 79)*
- [ ] SSE cross-tab: consider adding a leader tab indicator in dev mode for debugging

---

## Pillar 1: Decomposition Engine

- [x] **Expose dependency reason in GraphQL** — `reason` field added to TaskDependency typedef, shown as tooltip in dependency display *(Wave 80)*
- [ ] **Dependency inference during planning** — planner generates tasks but doesn't infer dependencies. Should output a dependency graph, not just a flat list
- [x] **Decision points in task plans** — taskKind (implementation/decision) with selectable options and recommendations in plan editor *(Wave 80)*
- [x] **Planning quality feedback loop** — execution history (last 10 completed/failed tasks with summaries) fed into hierarchical plan prompt *(Wave 80)*
- [x] **Scope estimation** — estimation calibration guidelines added to hierarchical plan prompt (AI agent execution time, not human time) *(Wave 80)*
- [x] **Decision task validation on commit** — enforce that all decision tasks have a selectedOption before allowing plan commit *(Wave 81)*
- [ ] **Dependency reason in plan editor** — show/edit dependency reasons in the HierarchicalPlanEditor dependency view, not just in task detail
- [ ] **Iterative refinement** — re-plan a subset of tasks when requirements change without regenerating the entire plan

---

## Pillar 2: Context Threading

- [x] **Dependency-aware execution ordering** — orchestrator checks blocking dependencies before starting tasks, emits task.blocked events for unmet deps *(Wave 79)*

---

## Pillar 3: Orchestration

- [ ] **Session auto start/stop** — simple start/stop toggle that kicks off autonomous loop: pick next task → generate plan → execute → proceed to next. With configurable retries. Premium feature candidate
- [ ] **Parallel execution streams** — independent tasks (no dependency) should execute in parallel. Requires DAG-based scheduler instead of sequential executor. Premium feature
- [x] **Re-planning on failure** — orchestrator auto-replans failed action plans up to 2 times with shared replanService *(Wave 81)*
- [ ] **Health monitoring** — detect stuck tasks, stale branches, conflicting changes. Alert user when intervention needed
- [ ] **Merge orchestration** — after PR approved + CI passes, auto-merge and trigger downstream tasks
- [ ] **Progress dashboard improvements** — project-level pipeline status ("3 of 12 tasks executing, 2 PRs open, 1 blocked on CI"), not just per-task action plans
- [ ] **Bidirectional GitHub sync** — GitHub events (commits, PR merges, issue closes, CI status) should update TaskToad task state. Currently one-directional. Webhook handler only creates link records, doesn't update task statuses
- [ ] **Agent abstraction** — decouple from direct Claude API calls. Support pluggable agents (Claude Code, Codex, local LLMs) behind common interface. Phase 4

---

## Onboarding & Scaffolding

- [x] **Existing repo onboarding flow** — intent threaded into bootstrap AI, post-bootstrap plan generation step added to wizard *(Wave 81)*
- [x] **AI-friendly repo scaffolding** — scaffold should also generate `CLAUDE.md` and `.claude-knowledge/` context files so repos are immediately usable with Claude Code/Codex *(Wave 81)*
- [ ] **Remove onboarding interview** — replace multi-question technical interview with organic KB seeding (project description, scaffold output, decision points, task summaries, repo analysis). Optional single free-text field on creation instead
- [ ] **Global org/user knowledge base** — context that spans all projects, not just per-project KB

---

## Code Quality & Testing

- [x] Test coverage for fix_review (approved skip, AI fixes with source, deferred tasks, duplicate detection) *(Wave 76)*
- [ ] Integration test for logout→login-as-different-user flow
- [ ] merge-worker.sh: auto-detect lockfile changes
- [ ] Test coverage for merge_pr executor (auto-update retry, state checks, conflict handling)
- [ ] Audit remaining Prisma status filters for stale values (`'pending'`/`'running'` vs `'approved'`/`'executing'`)

---

## Refactors

- [ ] **Split useProjectData** — 100+ properties → focused sub-interfaces
- [ ] **Resolver auth guards** — `requireEntity<T>()` helper, do incrementally
- [ ] **AI feature registry** — consolidate 40+ wrapper functions in aiService.ts
- [ ] **Extract insight generation to event listeners** — move from actionExecutor to async event-driven pattern

---

## Premium Feature Gating

- [ ] **Wire new premium features into license system** — as parallel execution, session auto-start, and agent abstraction are implemented, add them to `PREMIUM_FEATURES` in `license.ts`, add `requireLicense()` checks in resolvers, and gate UI with `hasFeature()`. Current concurrent plan limit (hardcoded to 1) should become plan-aware (`free: 1, paid: 3`)
- [ ] License gating test coverage — verify free users can't access premium features

---

## Future

- [ ] Scheduled report delivery (depends on SMTP — now configured)
- [ ] Stripe integration for billing (currently `updateOrgPlan` is admin-only with no payment flow)
- [ ] Multi-project decomposition — break down goals spanning multiple repos/projects

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
| 76 | 2026-03-31 | merge_pr hardening, resend verification email, PriorityDropdown a11y, session timeout cleanup, fix_review tests |
| 77 | 2026-03-31 | Auto-Complete button fix, commit attribution, kanban scroll, review collapsed, close sprint from board |
| 78 | 2026-04-01 | Concurrent plan prevention, fix_review reliability, hierarchical plan progress events |
| 79 | 2026-04-01 | Dependency reason + ordering, scaffold progress, deferred task quality, dependency UI |
| 80 | 2026-04-01 | Planning feedback loop, decision points in plans, scope estimation, dependency reason GraphQL |
| 81 | 2026-04-01 | Auto-replan on failure, repo onboarding intent threading, decision validation, AI-friendly scaffolding |

Full wave details in `changelog.md`.
