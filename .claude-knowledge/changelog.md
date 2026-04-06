# Development Changelog

94 swarm waves from 2026-03-18 to 2026-04-06. Most recent first. Last 5 waves detailed, older compressed.

---

## Wave 94 (2026-04-06) — AI-Enhanced Create Task Modal
- Replace inline title input with modal wizard: title, description, priority, type fields
- "Enhance with AI" button generates instructions, acceptance criteria, estimated hours
- AI-generated fields shown as editable inputs, user reviews before finalizing
- Pipeline fixes: step-level retry, startup recovery, SSE debounce, merge error parsing

## Wave 93 (2026-04-05) — UX Redesign: Autopilot View + Nav Consolidation
- New AutopilotView: pipeline stats, session controls, active plans, task list (default view)
- Navigation: 9 tabs → 3 primary (Autopilot, Backlog, Board) + More dropdown
- AI dropdown removed, items redistributed to sectioned overflow menu
- Sprint → Session rename across all user-facing labels

## Wave 92 (2026-04-05) — Open Source Pivot
- All features free: getEffectivePlan() always returns 'paid'
- Free tier limits removed, billing tab hidden
- Stripe code preserved (demonstrates billing engineering)
- MIT license added

## Wave 91 (2026-04-03) — Stripe Billing Integration
- Stripe Checkout, webhooks, billing portal
- Free tier limits: 3 projects, 3 members
- 14-day Pro trial on org creation
- Billing tab in OrgSettings with upgrade/manage buttons

## Wave 90 (2026-04-03) — UX Polish + Testing
- Release notes manual entry, time entry admin-only deletion
- SSE dev-mode leader indicator, mobile horizontal scroll
- Integration test for logout→login tenant isolation
- merge-worker.sh lockfile detection

---

## Wave 89 (2026-04-03) — Insight KB retrieval, AI feature registry, refinement wiring, swimlane overflow
## Wave 88 (2026-04-03) — Parallel execution, requireEntity auth guards, insight extraction, stale PR SSE
## Wave 87 (2026-04-02) — External merge post-actions, flat plan deps, premium gating, license tests
## Wave 86 (2026-04-02) — Refinement UX (epic selection, diff view), stale branch detection, merge_pr tests
## Wave 85 (2026-04-02) — CI fix retry limit, AI normalization, org KB retrieval + UI, pipeline dashboard detail
## Wave 84 (2026-04-01) — CI failure recovery, iterative plan refinement, global org KB, concurrent plan check
## Wave 83 (2026-04-01) — Bidirectional GitHub sync, merge orchestration, pipeline status dashboard
## Wave 82 (2026-04-01) — Quick Start autopilot, remove onboarding interview, health monitoring cron
## Wave 81 (2026-04-01) — Auto-replan on failure, repo onboarding intent, decision validation, AI-friendly scaffolding
## Wave 80 (2026-04-01) — Planning feedback loop, decision points in plans, scope estimation, dependency reason GraphQL
## Wave 79 (2026-04-01) — Dependency reason + ordering, scaffold progress, deferred task quality, dependency UI
## Wave 78 (2026-04-01) — Concurrent plan prevention, fix_review reliability, hierarchical plan progress events
## Wave 77 (2026-03-31) — Auto-Complete button fix, commit attribution, kanban scroll, review collapsed, close sprint from board
## Wave 76 (2026-03-31) — merge_pr hardening, resend verification email, PriorityDropdown a11y, session timeout cleanup
## Wave 75 (2026-03-30) — Column reorder wiring, sprint close→create flow, branch cleanup on cancel, SSE cross-tab sync
## Wave 74 (2026-03-28) — Test DB isolation, branch flow tests, priority colors, automation bot, column reorder, Zod audit
## Wave 73 (2026-03-28) — verify_build polling, session time/resume, chat validation, sprint auto-activate, AI loading states
## Wave 72 (2026-03-28) — verify_build action, sprint close reconciliation, session planning, session progress tracking
## Wave 71 (2026-03-28) — Code gen coherence: repo context, schema-first, decomposition, stall detection, branch naming
## Wave 70 (2026-03-27) — Actionable AI: projectChat actions, whatNext, dependency inference
## Waves 64-69 (2026-03-26) — Phase 1 pipeline, Phase 1.5 onboarding, Phase 2 context threading, Phase 3 orchestration
## Waves 61-63 (2026-03-25) — Pre-pipeline refactors, deferred refactors, closed-source cleanup
## Waves 57-60 (2026-03-23–24) — License system, project scaffolding, per-org licensing
## Waves 52-56 (2026-03-22–23) — Final cleanup, bug fixes, UX polish
## Waves 45-51 (2026-03-21) — P1/P2 features: SLA, automations, Monte Carlo, timesheet, approval workflows, initiatives, TQL
## Waves 42-44 (2026-03-21) — Security Phase 2-4: auth hardening, medium/low fixes, integration tests
## Waves 36-41 (2026-03-20) — Auto-Complete Pipeline Redesign: KB, planning, execution, insights, dashboard
## Wave 35 (2026-03-20) — Critical security fixes (C-1 through C-5, H-5/H-7/H-8/H-11)
## Waves 28-34 (2026-03-18–20) — Foundation: cleanup, dependency graph, filtering, swimlanes, watchers, WIP limits, hierarchy, ARIA, permissions
