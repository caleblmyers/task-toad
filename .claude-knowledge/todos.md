# TaskToad — Remaining Work & Tracking

59 swarm waves completed. Security: 38/39 (97%). Open core license system in place. 335 tests. **V1 ready — preparing for AGPL open source launch.**

---

## Swarm Rules

- **Task sizing:** 30-60 min per task. Full vertical slices (schema + resolver + typeDefs + frontend).
- **Parallelism:** Check file overlap. Two sets can run in parallel if their `files` arrays don't overlap.
- **File structure:** Prisma: `prisma/schema/`, TypeDefs: `typedefs/`, Resolvers: `resolvers/` — all domain-split.

---

## Deployment & Ops

- [x] Railway health check — configured via railway.toml
- [x] Sentry — confirmed receiving errors in production (2026-03-23)
- [ ] Custom domain (optional — Railway domain works for beta)

### Email (deferred — not needed for V1)
- Signup rate limiting in place (10/min per IP). No email verification required.
- SMTP deferred until custom domain is set up for deliverability.
- Password resets can be handled manually for early users.

---

## Premium Features (per-org plan + self-host override)

Premium features are gated behind `requireLicense(feature, orgPlan)` in resolvers and `useLicenseFeatures()` hook in frontend. Orgs with `plan='paid'` get access; `plan='free'` (default) gets `LICENSE_REQUIRED` error and UI hides premium sections. Self-host override: `TASKTOAD_LICENSE` env var bypasses per-org checks (all orgs get premium). See `apps/api/src/utils/license.ts`.

Infrastructure jobs/listeners (slack, SLA, cron) load org plan from DB per-event rather than checking at startup. Context type includes `plan: string` field.

- **Slack integration** — resolver gated + UI hidden in OrgSettings
- **Initiatives** (cross-project grouping) — resolver gated + UI removed (Wave 53)
- **SLA Tracking** — resolver gated + listeners/jobs check org plan per-event + UI removed (Wave 53)
- **Approval Workflows** — resolver gated + UI removed (Wave 53)
- **Scheduled Automations** (cron triggers) — cron fields gated in resolver + scheduler checks org plan per-rule + UI removed (Wave 53)
- **Workflow Role Restrictions** — role checks bypassed in task/mutations.ts when org not premium
- **Field-level Permissions** — resolver gated + settings tab hidden
- **Project Member Roles** — resolver gated + permissions.ts bypasses role lookup for non-premium orgs + members tab hidden
- **BacklogView keyboard navigation** — UI removed (Wave 53, re-enable as core when fixed)

### Per-org licensing follow-ups
- [ ] Frontend: add plan upgrade UI / billing page (org settings)
- [ ] Frontend: update `useLicenseFeatures` hook to read org plan from `me` query instead of static check
- [ ] API: add `updateOrgPlan` mutation (admin-only, or Stripe webhook)
- [ ] API: add plan field to org seed data / onboarding flow
- [ ] Consider caching org plan lookups in infrastructure jobs to reduce DB queries under load

---

## Priority — Next Up

### Project scaffolding for fresh codebases
New projects starting from scratch hit a bad UX: the auto-complete pipeline generates manual steps for project initialization (`create-next-app`, etc.) because the AI thinks interactive tools can't be automated. Two fixes needed:

1. **Project scaffolding step** — after creating a project, prompt user to connect/create a GitHub repo, then scaffold a base codebase from a template (Next.js, Vite+React, Express, etc.). This gives the AI a real codebase to plan against instead of trying to bootstrap from nothing inside task execution.
   - Flow: Create project → connect/create repo → pick framework template → scaffold + initial commit → ready for task planning
   - Templates should use non-interactive CLI flags (`--yes`, `--typescript`, etc.)
   - Knowledge base auto-populates from scaffolded code

2. **Fix AI planner for init commands** — update `promptBuilder.ts:buildActionPlanPrompt()` to instruct the AI that project initialization tools have non-interactive modes and should use `generate_code` actions, not `manual_step`. Include examples of non-interactive flags for common tools.

3. **Follow-ups from wave 58:**
   - `commitFilesToEmptyRepo` hardcodes `refs/heads/main` — should respect `repo.defaultBranch` for users with non-`main` default branch settings
   - Add unit tests for `ProjectSetupWizard` component
   - Template list is hardcoded client-side — consider server-side template registry for extensibility
   - Knowledge base auto-population after scaffold (trigger KB ingestion from committed files)

### Per-org licensing (Wave 59)
Move license checks from server-level env var to per-org `plan` field in the database. Enables hosted platform with both free and paid users on the same deployment. `TASKTOAD_LICENSE` env var becomes a self-host override.
- Spec: `~/brain/projects/task-toad/internal-docs/per-org-licensing.md`
- Add `plan` column to Org model (default "free")
- Update `license.ts`: `isPremiumEnabled(orgPlan?)` + `requireLicense(feature, orgPlan?)`
- Update all `requireLicense` call sites to pass `context.org.plan`
- Infrastructure jobs (SLA, cron) need to load org plan from DB
- Add `plan: String!` to Org GraphQL type
- No billing/Stripe yet — plan changes are manual DB updates

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

### Feature Requests
- [ ] Scheduled report delivery — ReportSchedule model, cron, email/Slack *(depends on SMTP)*
- [ ] Automation rule library + cross-project sharing
- Re-enable V1 cuts when ready (initiatives, SLA, approvals, cron automation, workflow restrictions)
- [ ] Gate WorkflowTab.tsx "Workflow Transition Restrictions" section behind `hasFeature('workflow_restrictions')` — role restriction UI is still visible without license
- [ ] Gate cron input fields in AutomationTab create/edit form behind `hasFeature('cron_automations')` — currently only display is hidden
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

Full wave details in `changelog.md`.
