# TaskToad — Remaining Work

91 swarm waves complete. Production deployed on Railway at `tasktoad.app`. Autopilot pipeline feature-complete. All three pillars implemented. Backlog nearly empty.

---

## Launch Blockers

- [ ] **Landing page polish** — current version is functional but needs professional design work
- [ ] **Test signup flow on prod** — verify Resend emails arrive, full signup→verify→login works
- [x] **Stripe integration for billing** — checkout, webhooks, portal, upgrade UI (Wave 91)

---

## Remaining Work

### Pipeline
- [ ] **Hierarchical plan streaming results** — stream partial results (epics first, then tasks) instead of waiting for full response

### Orchestration
- [ ] **Agent abstraction** — pluggable AI backends (Claude Code, Codex, local LLMs). Phase 4

### Refactors
- [ ] **Resolver auth guards: broader adoption** — requireEntity applied to ~13 mutations; ~15+ more could benefit
- [ ] **AI feature registry: broader adoption** — 8 functions converted to callAIFeature; remaining complex functions still direct

### Manual Testing
- [ ] Verify concurrent plan execution doesn't corrupt branch state
- [ ] Verify failed plan leaves branch in recoverable state

### Billing Polish (low priority — all features free post-pivot)
- [ ] **Hide Stripe internal IDs from GraphQL** — `stripeCustomerId` and `stripeSubscriptionId` are exposed in the Org type; only admins should see these (or remove from public schema)
- [x] ~~**Upgrade prompts at limit boundaries**~~ — moot, all features free (Wave 92)
- [x] ~~**`getEffectivePlan` in more resolvers**~~ — moot, always returns 'paid' (Wave 92)
- [ ] **Stripe webhook idempotency** — add idempotency key handling for webhook retries
- [x] ~~**`me` query: expose `trialEndsAt`**~~ — moot, no trial logic (Wave 92)

### Test Reliability
- [ ] **Fix SMTP timeout in integration tests** — tests that create users trigger email verification with 3x retry + backoff, consuming the 5000ms test timeout. Mock email transport in test setup or skip sending when SMTP_HOST is not configured

### Pipeline Bugs
- [x] **review_pr: retry on PR diff 404** — now returns retryable: true, step-level retry handles it *(fixed in session)*
- [x] **Auto-replan vs step retry** — executor now retries failed steps up to 3x before escalating to plan failure *(fixed in session)*
- [ ] **Planner generates redundant setup tasks after scaffold** — AI planner doesn't know the scaffold already created the app. Planning prompt should include repo state or scaffold output to avoid "Set up X application" tasks that duplicate scaffolded work
- [ ] **AI review hallucinating issues on clean code** — review_pr prompt is too aggressive, inventing "hardcoded secrets" and "XSS vulnerabilities" on boilerplate scaffold code. Calibrate the review prompt to focus on actual PR diff changes, not imagined problems
- [ ] **merge_pr reports false conflicts** — executor reports "merge conflicts that require manual resolution" but GitHub shows clean PR. Investigate timing/state check accuracy
- [ ] **Reset stuck actions on server startup** — when server crashes mid-execution, actions stay in "executing" forever. On startup, find actions stuck in "executing" for >5 minutes and reset them to "failed" so they can be retried
- [ ] **Clean up stale PRs/branches on replan** — when a plan fails and replans, the old PR and feature branch stay open on GitHub. Replan should close the old PR and delete the branch before creating a new plan
- [ ] **Reduce manual_step usage in action plans** — planner generates manual_step for things like "gather API keys" which blocks the pipeline. Instead, the AI should research and document what's needed (which APIs, signup links, scopes) as a deferred task or knowledge entry, then continue with the pipeline. manual_step should only be used for things that genuinely can't proceed without human input (e.g., "deploy to production")

### UX Polish
- [ ] **Rebrand sprint UI for autopilot context** — "Plan Sprint" → "Plan Session", "Create Sprint" → "Create Session". Sprints are a human-team concept; sessions are the autopilot concept. Both coexist but the default language should favor sessions for autopilot users. See autopilot-pillars.md "Sessions vs Sprints" section.

### Future
- [ ] **Multi-org support** — users can only belong to one org (`user.orgId` is a single field). Freelancers/contractors who work on personal projects AND join a client's team can't do both. Needs: join table, org switcher UI, auth context per-org, billing per-org. Build when team adoption creates demand.
- [ ] Scheduled report delivery
- [ ] Multi-project decomposition — goals spanning multiple repos/projects
- [ ] Replace stacked modals with single-panel wizard (step 1 of N)

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
| 91 | 2026-04-03 | Stripe billing integration, free tier limits (3 projects, 3 members), 14-day Pro trial, upgrade UI |

Full wave details in `changelog.md`.
