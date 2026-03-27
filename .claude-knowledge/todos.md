# TaskToad — Remaining Work & Tracking

70 swarm waves completed. 356 tests. 0 lint warnings. **Autopilot for software projects — all three pillars + AI assistant implemented.**

**Actionable AI assistant complete (Wave 70).** projectChat suggests actions with Apply buttons, What's Next? prioritizes work, dependency inference in planner. See `autopilot-pillars.md` for the full spec.

---

## Quick Hits (before Phase 1)

- [x] Replace `LICENSE` file — remove AGPL-3.0, add proprietary license text *(Wave 63)*
- [x] Remove or rewrite `CONTRIBUTING.md` for closed source *(Wave 63)*
- [x] Remove `TASKTOAD_LICENSE` env var and self-host override code *(Wave 63)*
- [x] Remove Docker self-hosting config — deploy profile removed from `docker-compose` *(Wave 63)*
- [x] Project bootstrap modals should not be dismissable by clicking outside during an active process *(Wave 63)*
- [x] "open source mode" comments updated to "free plan" in permissions.ts *(Wave 65)*
- [x] Add test coverage for Modal `closeOnOverlayClick` prop behavior *(Wave 65)*
- [x] ProjectSetupWizard test has `act(...)` warning — wrap state updates in test *(Wave 65)*
- [x] Update stale "open source mode" comments in permissions.ts to "free plan" *(Wave 65)*

## Investigate

- [x] **Session / cross-account data leak** — fixed: App tree remounts on user change via `key={userId}` *(Wave 63)*
- [ ] Consider adding an integration test for the logout→login-as-different-user flow to prevent regression

---

## Phase 1: Pipeline Rewrite — Branch-Based Code Generation *(Wave 64 — DONE)*

All 5 implementation tasks completed:
- [x] Branch management in actionExecutor.ts — branchName/headOid on TaskActionPlan, feature branch at plan start *(Wave 64)*
- [x] generateCode executor commits to branch — files committed after AI gen, headOid updated *(Wave 64)*
- [x] writeDocs executor commits to branch — same pattern as generateCode *(Wave 64)*
- [x] createPR executor uses existing branch — opens PR from feature branch, no file creation *(Wave 64)*
- [x] Planner enforces create_pr + review_pr — code + prompt enforcement, skeptical reviewer prompt *(Wave 64)*
- [x] Zod config validation for all executors (R13 partial) *(Wave 64)*
- [x] monitor_ci + fix_ci added to ActionPlanItemSchema *(Wave 64)*
- [x] fetchProjectFileTree accepts branch parameter for context *(Wave 64)*

**Next:** Manual end-to-end test (new project → scaffold → task → auto-complete → PR on GitHub).

---

## Phase 1 Follow-Ups

### Critical (P0)
- [x] **Catch commitFiles failures in generateCode/writeDocs** — try/catch returns structured failure, prevents headOid corruption *(Wave 65)*
- [x] **Add concurrency guard for branch creation** — optimistic re-read of plan before creating branch *(Wave 65)*

### High Priority (P1)
- [x] **Post AI review to GitHub PR** — review_pr executor now posts as APPROVE/REQUEST_CHANGES via GitHub REST API *(hotfix)*
- [x] **SSE: task.action_started event** — UI now updates when actions begin executing, not just when they complete *(hotfix)*
- [x] **Approve & Continue UI refresh** — refetch action plan after approve so UI reflects executing state *(hotfix)*
- [x] **fix_review executor** — auto-fixes small review issues, creates backlog tasks for larger ones. Planner enforces generate_code → create_pr → review_pr → fix_review pipeline. Validation in commitActionPlan. *(Wave 65)*
- [ ] **Add integration test suite for branch flow** — branch creation, sequential commits, commit failure handling, review outcomes (~5 tests, mock GitHub API)
- [x] **Implement OAuth token routing for personal repos** — loads user OAuth token for personal accounts, passes through ActionContext to createBranch and commitFiles *(Wave 65)*

### Wave 68 Follow-Ups (Sessions & Orchestration)
- [ ] **Session progress: track token usage and cost** — session progress `tokensUsed` and `estimatedCostCents` are initialized to 0 but never updated by the orchestrator. Wire AI usage tracking from action plan execution into session progress.
- [ ] **Session time limit enforcement** — `timeLimitMinutes` is in SessionConfig but not checked by the orchestrator. Add a time limit check alongside budget/scope checks.
- [ ] **Session resume (start paused session)** — `startSession` allows re-starting paused sessions, but doesn't un-set `autoComplete` on tasks if they were removed from the session. Consider edge cases.
- [ ] **replanFailedTask: extracting shared plan creation logic** — replanFailedTask duplicates the plan creation + ID remapping pattern from commitActionPlan. Consider extracting into a shared helper to reduce drift.
- [x] **Session progress race condition** — fixed: atomic SQL jsonb_set increments in orchestratorListener *(Wave 69)*
- [ ] **Test coverage for sessions** — no unit tests for: session CRUD resolvers, session-aware orchestration, budget/scope limit checks, failure policy handling. Add tests.
- [x] **SessionDialog error handling** — fixed: inline error display in SessionDialog *(Wave 69)*
- [x] **Webhook event userId** — fixed: resolves org admin userId instead of 'system' *(Wave 69)*

### Wave 67 Follow-Ups (Context Threading)
- [x] **Task status → done transition after review** — fixed: auto-transitions to done when review approved or fix_review completes *(Wave 69)*
- [x] **writeDocs/fixReview: add upstreamTaskContext and failureContext** — fixed: all three context fields wired to writeDocs and fixReview *(Wave 69)*
- [ ] **Test coverage for context threading** — no unit tests for: previousStepContext building, upstream summary loading (raw SQL query in actionExecutor), failure context round-trip, completion summary generation. Add tests for each.
- [x] **projectChat: handle missing completionSummary gracefully** — fixed: proper Prisma select with completionSummary field *(Wave 69)*
- [ ] **Rate limiting for completionSummary generation** — each plan completion triggers an AI call for summary generation. Consider caching or skipping if budget is exhausted.

### Wave 66 Follow-Ups (Onboarding Redesign)
- [x] **Clean up redundant type cast in scaffoldProject resolver** — fixed: uses args.config directly *(Wave 69)*
- [x] **Wire analyzeIntent to bootstrapProjectFromRepo** — fixed: saved as KB entry before bootstrap *(Wave 69)*
- [x] **Remove dead backend mutations** — fixed: onboarding mutations removed from GraphQL schema and resolvers *(Wave 69)*

### Wave 65 Follow-Ups
- [x] **fix_review executor: pass userGitHubToken** — fixed: added to commitFiles call *(Wave 69)*
- [ ] **fix_review: test coverage** — no unit tests for fixReview executor. Should test: approved review skip, AI fix generation, deferred issue → backlog task creation, duplicate task detection.
- [x] **Pre-existing lint warning** — fixed: extracted deps from `d` before useEffect in ProjectDetail.tsx *(Wave 69)*

### Medium Priority (P2)
- [ ] **Branch cleanup strategy** — decide: auto-delete failed/cancelled plan branches, tag with prefix, or retention policy
- [ ] **Extract insight generation + in_review transition to event listeners** (R10) — move from actionExecutor handler to async event-driven pattern
- [ ] **Audit executor config Zod validation** — verify manual_step and monitor_ci have schemas (others are done)

### Manual Testing
- [ ] End-to-end: new project → scaffold → task → auto-complete → branch created → PR opened → review posted
- [ ] Verify concurrent plan execution doesn't corrupt branch state
- [ ] Verify failed plan leaves branch in recoverable state

---

## Post-Phase 1 Backlog

### Remaining Refactors
- **R5: Split useProjectData** — 100+ properties → focused sub-interfaces. P2.
- **R7: Resolver auth guards** — `requireEntity<T>()` helper. P3. Do incrementally.
- **R3: AI feature registry** — consolidate 40+ wrapper functions in aiService.ts. Do if touching file.

### UX Improvements
- [ ] Chat actions: add input validation for applyChatAction (verify taskId belongs to project, validate required fields per action type)
- [ ] Chat actions: add activity log entries when tasks are created/updated via chat actions
- [ ] WhatNextPanel: add refresh button to re-fetch suggestions after applying actions
- [ ] ProjectChatPanel: wire `onSelectTask` prop from ProjectDetail (currently optional, not passed)
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
- [x] Fix React act() warnings in ProjectSetupWizard tests *(Wave 65)*
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
| 63 | 2026-03-25 | Quick hits: closed-source cleanup, modal dismiss fix, session security fix |
| 64 | 2026-03-26 | Phase 1: branch-based pipeline — branch management, generateCode/writeDocs commit, createPR rewrite, planner enforcement, skeptical reviewer |
| 65 | 2026-03-26 | Phase 1 follow-ups: commitFiles error handling, concurrency guard, OAuth routing, fix_review executor, quick hits (Modal tests, act() fix, open-source refs) |
| 66 | 2026-03-26 | Phase 1.5: AI stack recommendations, scaffold config, existing repo onboarding, interview removal, CLAUDE.md in scaffold, KB seeding from stack choice |
| 67 | 2026-03-26 | Phase 2: context threading — execution result forwarding, completion summaries, upstream context wiring, failure propagation, projectChat KB+deps |
| 68 | 2026-03-26 | Phase 3: orchestration — Session model, GitHub→orchestrator bridge, re-planning on failure, session-aware orchestrator, session UI |
| 69 | 2026-03-26 | Follow-up cleanup: in_review→done transition, session race condition, context wiring, dead mutations, lint fix, type casts, analyzeIntent |
| 70 | 2026-03-27 | Actionable AI: projectChat with suggestedActions + Apply, whatNext query, What's Next? panel, dependency inference in planner |

Full wave details in `changelog.md`.
