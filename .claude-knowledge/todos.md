# TaskToad — Remaining Work

84 swarm waves complete. Production deployed on Railway at `tasktoad.app`. Autopilot pipeline feature-complete for launch.

---

## Launch Blockers

- [ ] **Landing page polish** — current version is functional but needs professional design work
- [ ] **Test signup flow on prod** — verify Resend emails arrive, full signup→verify→login works
- [ ] **Stripe integration for billing** — currently `updateOrgPlan` is admin-only with no payment flow

---

## Pipeline Polish

- [ ] **Move fix_review normalization before Zod validation** — normalization in fixReview.ts runs after `callAIStructured` already validates (dead code). Move inside `callAIStructured` before `safeParse`
- [ ] **CI fix retry limit** — fix_ci can loop (fix_ci → monitor_ci → fix_ci) but there's no max retry count. Add configurable cap to prevent infinite fix loops
- [ ] **External merge: post-merge actions** — pr_merged handler completes the action plan but skips post-merge actions (write_docs). Consider selective skipping
- [ ] SSE cross-tab: dev-mode leader tab indicator

---

## Decomposition & Planning

- [ ] **Dependency inference during planning** — the flat `generateTaskPlan` path doesn't infer dependencies (hierarchical plan already does)
- [ ] **Dependency reason in plan editor** — show/edit dependency reasons in HierarchicalPlanEditor, not just in task detail
- [ ] **Refinement: epic-level selection** — currently only task-level checkboxes for refinement; allow selecting entire epics
- [ ] **Refinement: diff view** — show what changed between original and refined tasks before committing

---

## Orchestration

- [ ] **Parallel execution streams** — independent tasks (no dependency) should execute in parallel. DAG-based scheduler. Premium feature
- [ ] **Agent abstraction** — pluggable AI backends (Claude Code, Codex, local LLMs). Phase 4

---

## Onboarding & Knowledge Base

- [ ] **Org KB retrieval in AI prompts** — org-level KB entries exist but aren't fed into planning/generation prompts. Update `retrieveRelevantKnowledge`
- [ ] **Org KB management UI** — no UI to view/create/edit org-level KB entries. Add org settings section

---

## Dashboard & UX

- [ ] **Pipeline dashboard: active plans detail** — PipelineOverview shows count but doesn't link to specific plans. Add expandable list
- [ ] **Quick Start task count optimization** — add lightweight `projectTaskCounts` query instead of fetching all tasks
- [ ] **Health monitor: stale branch detection** — extend to detect PRs open > 7 days with no activity
- [ ] **Hierarchical plan streaming results** — stream partial results (epics first, then tasks) instead of waiting for full response
- [ ] **Swimlane-specific overflow** — individual swimlane sections may need own max-height + scroll
- [ ] Release notes: manual entry option
- [ ] Time entry deletion: admin-only
- [ ] Mobile: horizontal scrolling on project page

---

## Premium Feature Gating

- [ ] **Wire premium features into license system** — parallel execution, agent abstraction. Make concurrent plan limit plan-aware (`free: 1, paid: 3`)
- [ ] License gating test coverage

---

## Code Quality & Testing

- [ ] Integration test for logout→login-as-different-user flow
- [ ] Test coverage for merge_pr executor (auto-update retry, state checks, conflict handling)
- [ ] Audit remaining Prisma status filters for stale values (`'pending'`/`'running'` vs `'approved'`/`'executing'`)
- [ ] merge-worker.sh: auto-detect lockfile changes

---

## Refactors

- [ ] **Split useProjectData** — 100+ properties → focused sub-interfaces
- [ ] **Resolver auth guards** — `requireEntity<T>()` helper, do incrementally
- [ ] **AI feature registry** — consolidate 40+ wrapper functions in aiService.ts
- [ ] **Extract insight generation to event listeners** — move from actionExecutor to async event-driven

---

## Future

- [ ] Scheduled report delivery
- [ ] Multi-project decomposition — goals spanning multiple repos/projects
- [ ] Replace stacked modals with single-panel wizard (step 1 of N)

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
| 82 | 2026-04-01 | Quick Start autopilot, remove onboarding interview, health monitoring cron |
| 83 | 2026-04-01 | Bidirectional GitHub sync, merge orchestration, pipeline status dashboard |
| 84 | 2026-04-01 | CI failure recovery, iterative plan refinement, global org KB, concurrent plan check optimization |

Full wave details in `changelog.md`.
