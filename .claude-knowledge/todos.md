# TaskToad — Status

94 swarm waves complete. Production deployed on Railway at `tasktoad.app`. Open source portfolio piece (MIT license). All three autopilot pillars implemented.

**Status: Feature complete.** No further development planned. Remaining items documented as known issues for future reference.

---

## Known Issues (not planned to fix)

### Pipeline
- Planner generates redundant setup tasks after scaffold (needs repo context in prompt)
- AI review hallucinating issues on clean code (prompt calibration needed)
- merge_pr reports false conflicts occasionally (timing issue)
- Stale PRs/branches not cleaned up on replan
- manual_step blocks pipeline for things AI could plan around
- GitHub OAuth token expiry not surfaced in UI

### UX
- AutopilotView missing drag-and-drop task reordering and inline editing
- Analytics items (Standup, Health, Trends, Cycle Time) removed from toolbar but not added to Dashboard view
- ViewType union defined in 3 files (should be extracted to shared types)
- Landing page needs professional design

### Technical Debt
- Resolver auth guards only applied to ~13 mutations (~15+ more could benefit)
- AI feature registry only covers 8 of 40+ functions
- Stripe webhook idempotency not implemented
- SMTP timeout in integration tests (email retry consumes test timeout)
- Hierarchical plan streaming (partial results) not implemented

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
| 85 | 2026-04-02 | CI fix retry limit, AI normalization, org KB retrieval + UI, pipeline dashboard detail |
| 86 | 2026-04-02 | Refinement UX (epic selection, diff view), stale branch detection, merge_pr tests, status audit |
| 87 | 2026-04-02 | External merge post-actions, flat plan deps, premium gating, license tests |
| 88 | 2026-04-03 | Parallel execution, requireEntity auth guards, insight extraction, stale PR SSE |
| 89 | 2026-04-03 | Insight KB retrieval, AI feature registry, refinement wiring, swimlane overflow |
| 90 | 2026-04-03 | Release notes manual entry, time entry admin-only, SSE leader indicator, mobile scroll, auth test, lockfile detection |
| 91 | 2026-04-03 | Stripe billing integration, free tier limits, 14-day Pro trial, upgrade UI |
| 92 | 2026-04-05 | Remove premium gating, MIT license, open source pivot |
| 93 | 2026-04-05 | UX redesign: AutopilotView, nav consolidation, AI dropdown removed, sprint → session |
| 94 | 2026-04-06 | AI-enhanced create task modal wizard, pipeline fixes, startup recovery, SSE debounce |

Full wave details in `changelog.md`.
