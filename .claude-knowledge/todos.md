# TaskToad — Remaining Work & Tracking

60 swarm waves completed. Security: 38/39 (97%). 348 tests. **Strategic pivot to closed-source SaaS autopilot — building the three pillars (decomposition, context threading, orchestration).**

---

## Closed-Source Cleanup

- [ ] Replace `LICENSE` file — remove AGPL-3.0, add proprietary license text
- [ ] Remove or rewrite `CONTRIBUTING.md` for closed source (no external contributors expected)
- [ ] Remove `TASKTOAD_LICENSE` env var and self-host override code (or repurpose for enterprise tier)
- [ ] Remove Docker self-hosting config if still present (`docker-compose` deploy profile)

## Deployment & Ops

- [ ] Custom domain (optional — Railway domain works for beta)

### Email (deferred — not needed for V1)
- Signup rate limiting in place (10/min per IP). No email verification required.
- SMTP deferred until custom domain is set up for deliverability.
- Password resets can be handled manually for early users.

---

## Premium Features (per-org plan)

Premium features are gated behind `requireLicense(feature, orgPlan)` in resolvers and `useLicenseFeatures()` hook in frontend. Orgs with `plan='paid'` get access; `plan='free'` (default) gets `LICENSE_REQUIRED` error and UI hides premium sections. See `apps/api/src/utils/license.ts`.

Pricing splits on **orchestration depth**: free tier = basic AI planning + single-agent execution; paid tier = full autopilot pipeline (dependency-aware sequencing, parallel execution, context threading, auto-retry).

Infrastructure jobs/listeners (slack, SLA, cron) load org plan from DB per-event with 5-min TTL cache (`orgPlanCache.ts`). Context type includes `plan: string` field.

- **Slack integration** — resolver gated + UI hidden in OrgSettings
- **Initiatives** (cross-project grouping) — resolver gated + UI removed (Wave 53)
- **SLA Tracking** — resolver gated + listeners/jobs check org plan per-event + UI removed (Wave 53)
- **Approval Workflows** — resolver gated + UI removed (Wave 53)
- **Scheduled Automations** (cron triggers) — cron fields gated in resolver + scheduler checks org plan per-rule + UI removed (Wave 53)
- **Workflow Role Restrictions** — role checks bypassed in task/mutations.ts when org not premium
- **Field-level Permissions** — resolver gated + settings tab hidden
- **Project Member Roles** — resolver gated + permissions.ts bypasses role lookup for non-premium orgs + members tab hidden
- **BacklogView keyboard navigation** — UI removed (Wave 53, re-enable as core when fixed)

---

## Post-V1 Backlog

### UX Improvements
- [ ] Sprint columns should be reorderable
- [ ] Close sprint should offer "create new sprint" option
- [ ] Release notes should have manual entry option
- [ ] Time entry deletion should be admin-only action
- [ ] Time log entries not editable (can delete and re-add)
- [ ] Mobile: horizontal scrolling messy on project page
- [ ] Automation comments should not be attributed to a user (use system/bot)
- [ ] Onboarding wizard questions too advanced for new users — discuss approach
- [ ] Project settings could use a guided tour or overview — lots of options
- [ ] Sprint task dropdown shows archived sprints
- [ ] Priority dropdown: color coding (red for critical, orange for high)
- [ ] SSE cross-tab sync — manual refresh is fine for now; ensure backend prevents stale data overwrites

### Code Quality
- [ ] Fix React act() warnings in ProjectSetupWizard tests (state updates during async template fetch)
- [ ] Refactor: extract shared action-completion orchestration from actionExecutor.ts and monitorCIPoll.ts
- [ ] useAsyncData: ReleaseListPanel still uses inline fetch pattern
- [ ] merge-worker.sh: auto-detect lockfile changes and run pnpm install before validation
- [ ] TQL value autocomplete for dynamic fields (assignee, label) — fetch project-specific values
- [ ] Automation rule edit: add test coverage for edit/save flow
- [ ] @mention tab-to-select: MentionAutocomplete keyboard navigation for dropdown
- [ ] @mention notification tests: unit tests for displayName-based mention parsing
- [ ] Dependency task picker: keyboard navigation for search results
- [ ] L-12: Test database credentials in CI/CD
- [ ] Workflow restriction model: add test coverage for restriction/allowedRoles logic
- [ ] Auth retry: add test for UNAUTHENTICATED error detection and token refresh in gql() client
- [ ] Saved views: test coverage for filter capture (round-trip save → load with all filter types)

### Action Pipeline Rewrite — Branch-Based Code Generation

The action plan pipeline needs a fundamental rework so that generated code is committed incrementally to a feature branch, making each step visible to subsequent steps and ending with a real PR.

**Current broken flow:**
- `generate_code` stores files in the action's `result` field (in-memory only)
- Multiple `generate_code` steps can't see each other's output
- `create_pr` is often missing from plans because `getProjectRepo()` returns null during planning
- `write_docs` generates docs but doesn't commit them
- Net result: AI generates code that never reaches the repo

**Target flow:**
1. When an action plan starts execution, create a feature branch: `tasktoad/<task-slug>` from the default branch
2. `generate_code` → generates files → **commits to the feature branch immediately**
3. Subsequent `generate_code` → reads the feature branch (sees previous commits) → commits on top
4. `write_docs` → generates docs → commits to the same feature branch
5. `create_pr` → opens PR from the feature branch to default branch (no longer creates files itself)
6. `review_pr` → reviews the PR
7. `monitor_ci` / `fix_ci` → existing flow works as-is

**Implementation tasks (5 vertical slices):**

1. **Branch management in actionExecutor.ts** (~45 min)
   - When a plan starts executing, create a feature branch via `createBranch()` from `githubCommitService.ts`
   - Store `branchName` and `headOid` on the `TaskActionPlan` model (new fields: `branchName String?`, `headOid String?`)
   - Pass branch context to each action executor via `ActionContext`
   - Need migration for new fields on `task_action_plans` table
   - For personal GitHub accounts, pass user's OAuth token (same pattern as scaffold resolver)
   - Files: `actionExecutor.ts`, `actions/types.ts`, prisma schema, migration

2. **Update generateCode executor to commit** (~45 min)
   - After AI generates files, commit them to the feature branch using `commitFiles()`
   - Update `headOid` on the plan after each commit
   - Return the commit URL in the action result
   - Read the feature branch's file tree (not main) for context so subsequent steps see previous work
   - Files: `executors/generateCode.ts`, `actionExecutor.ts`

3. **Update writeDocs executor to commit** (~30 min)
   - Same pattern as generateCode — commit docs to the feature branch
   - Files: `executors/writeDocs.ts`

4. **Update createPR executor to use existing branch** (~30 min)
   - Instead of creating files from scratch, just open a PR from the feature branch to default branch
   - Read the branch name from the plan context
   - Remove file-creation logic (files are already committed)
   - Files: `executors/createPR.ts`

5. **Fix planner to always include create_pr when repo is connected** (~30 min)
   - The `hasGitHubRepo` check in `taskaction.ts` resolver is correct, but the plan was generated without a repo
   - Ensure the planning resolver checks repo connection and refuses to plan if no repo (with clear error message)
   - OR: make the planner always generate `create_pr` + `review_pr` for GitHub-connected projects (enforce in code, not just prompt)
   - Update planner prompt to emphasize: every plan for a connected repo MUST end with `create_pr` → `review_pr`
   - Files: `resolvers/taskaction.ts`, `promptBuilders/planning.ts`

**Parallelism:** Tasks 1+5 can run in parallel (no file overlap). Tasks 2+3 depend on task 1 (need branch context in ActionContext). Task 4 depends on task 2 (needs to understand the new commit flow). Suggested split: Worker 1 does tasks 1+2, Worker 2 does tasks 3+4 (after 1 merges), Worker 3 does task 5.

**Key files:**
- `apps/api/src/infrastructure/jobs/actionExecutor.ts` — orchestrates action execution
- `apps/api/src/actions/types.ts` — ActionContext interface
- `apps/api/src/actions/executors/generateCode.ts` — code generation
- `apps/api/src/actions/executors/writeDocs.ts` — docs generation
- `apps/api/src/actions/executors/createPR.ts` — PR creation
- `apps/api/src/github/githubCommitService.ts` — commit/branch operations
- `apps/api/src/graphql/resolvers/taskaction.ts` — plan generation resolver
- `apps/api/src/ai/promptBuilders/planning.ts` — AI planner prompt
- `apps/api/prisma/schema/` — TaskActionPlan model (needs branchName, headOid fields)

### Feature Requests
- [ ] Scheduled report delivery — ReportSchedule model, cron, email/Slack *(depends on SMTP)*
- [ ] Automation rule library + cross-project sharing
- Re-enable V1 cuts when ready (initiatives, SLA, approvals, cron automation, workflow restrictions)
- [ ] Add plan field to org seed data / onboarding flow
- [ ] Stripe integration for billing (Plans tab has placeholder)

### License Gating Gaps
- [x] Gate WorkflowTab.tsx "Workflow Transition Restrictions" section behind `hasFeature('workflow_restrictions')`
- [x] Gate cron input fields in AutomationTab create/edit form behind `hasFeature('cron_automations')`
- [ ] Add test coverage for license gating (both API resolvers returning LICENSE_REQUIRED and frontend feature hiding)

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
| 60 | 2026-03-24 | Scaffolding follow-ups (default branch fix, template registry, KB auto-populate, wizard tests) + licensing frontend/backend (orgPlan in me query, updateOrgPlan mutation, org plan cache, Plans tab) |

Full wave details in `changelog.md`.
