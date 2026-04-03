# TaskToad — Pricing & Feature Tiers

This document defines what's free, what's premium, and what's planned. **Read this before adding features** — don't give away premium features on the free plan.

---

## Pricing Philosophy

- **Free tier is generous enough to be useful** — a solo developer can run their project autopilot with real value
- **Paid tier unlocks scale and team features** — parallel execution, team roles, integrations, SLAs
- **The moat is the pipeline, not the PM dashboard** — free users get the autopilot (sequentially), paid users get it at scale
- **AI costs are real** — free tier should have reasonable AI usage limits to prevent abuse

---

## Free Plan

Everything a solo developer or small team needs to use TaskToad as an autopilot:

### Core Autopilot (the product)
- Project creation, task management, sprints, board views
- **AI planning** — hierarchical plan generation with decision points, dependency inference, feedback loop
- **AI code generation** — Auto-Complete with full pipeline (generate → PR → review → merge)
- **Session execution** — Quick Start autopilot (sequential, 1 task at a time)
- **Auto-replan on failure** — up to 2 retries with failure context
- **CI monitoring + fix_ci recovery** — webhook-driven CI status
- **Real-time progress** — SSE events, pipeline dashboard, action progress

### GitHub Integration
- Connect repos, create PRs, merge, branch management
- Bidirectional sync (webhooks update task state)
- Bot-attributed commits (TaskToad[bot])

### Knowledge Base
- Project-level KB with organic seeding (scaffold, bootstrap, task summaries)
- Org-level KB entries
- AI-powered KB retrieval in prompts

### PM Dashboard
- Kanban board with drag-and-drop, swimlanes, column reorder
- Backlog view, table view, calendar, timeline, Gantt
- Task dependencies with reasons
- Custom fields, labels, priorities
- Comments, activity feed
- Basic reports (standup, sprint, health)

### Limits (to define)
- **Concurrent execution:** 1 task at a time (sequential only)
- **AI budget:** TBD — consider per-month token cap or request limit
- **Projects:** TBD — consider 3-5 project limit
- **Team size:** TBD — consider 1-3 members

---

## Paid Plan

Everything in Free, plus:

### Scale & Parallel Execution
- **Parallel execution streams** — up to 3 concurrent tasks (premium, Wave 88)
- Higher AI budget / usage limits
- Unlimited projects
- Larger team size

### Team & Workflow
- **Project roles** — viewer/editor/admin per project (gated)
- **Field permissions** — role-based access to specific fields (gated)
- **Approval workflows** — task transition approvals (gated)
- **SLA policies** — response/resolution timers with breach detection (gated)

### Integrations
- **Slack integration** — webhooks, user mappings, notifications (gated)
- **Cron automations** — scheduled automation rules (gated, event-based automations are free)

### Portfolio
- **Initiatives** — cross-project portfolio tracking (gated)

---

## Currently Gated (in code)

These features have `requireLicense()` checks in resolvers:

| Feature | Code Key | Resolver | Status |
|---------|----------|----------|--------|
| Slack | `slack` | slack.ts | Gated |
| Initiatives | `initiatives` | initiative.ts | Gated |
| SLA policies | `sla` | sla.ts | Gated |
| Approvals | `approvals` | approval.ts | Gated |
| Cron automations | `cron_automations` | projectrole.ts | Gated |
| Field permissions | `field_permissions` | fieldpermission.ts | Gated |
| Project roles | `project_roles` | projectrole.ts | Gated |
| Parallel execution | `parallel_execution` | orchestratorListener.ts | Gated (limit-based) |
| Workflow restrictions | `workflow_restrictions` | — | Defined but unused |

Frontend gating: `useLicenseFeatures()` hook checks `orgPlan` and conditionally renders premium UI.

---

## Not Yet Gated (decide before launch)

These features are available to all users. Decide if any should be premium:

| Feature | Current | Recommendation |
|---------|---------|---------------|
| GitHub integration | Free | **Keep free** — core to the autopilot value prop |
| Event-based automations | Free | **Keep free** — basic automation is table stakes |
| Webhooks (non-Slack) | Free | **Keep free** — developers expect this |
| Org-level KB | Free | **Keep free** — improves AI quality for everyone |
| Reports & dashboards | Free | Consider gating advanced reports (trend analysis, Monte Carlo) |
| Time tracking | Free | **Keep free** — basic feature |
| Custom fields | Free | **Keep free** — basic feature |
| Multiple sprints | Free | Consider gating sprint analytics (velocity, burndown) |

---

## Pricing Structure (to define)

### Options to Consider
1. **Flat monthly** — $X/user/month for paid plan
2. **Usage-based** — free tier with AI token cap, pay per additional usage
3. **Hybrid** — flat monthly + usage overage for AI

### Key Decisions Needed
- [ ] Monthly price point
- [ ] Free tier AI usage limits (tokens/requests per month)
- [ ] Free tier project/team size limits
- [ ] Stripe product/price IDs
- [ ] Trial period for paid features?
- [ ] Annual discount?

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Org plan field (`free`/`paid`) | ✅ In DB |
| `requireLicense()` checks | ✅ 8 features gated |
| `useLicenseFeatures()` frontend hook | ✅ Hides premium UI |
| `updateOrgPlan` mutation | ✅ Admin-only, no payment flow |
| Stripe integration | ❌ Not started |
| Payment flow (subscribe/cancel) | ❌ Not started |
| Usage metering | ❌ Not started |
| Plan limits enforcement | ⚠️ Partial (concurrent execution only) |

---

## Rules for Development

1. **Never add premium features to the free plan** — check this doc before implementing
2. **New features default to free** unless they're in the "Paid Plan" section above
3. **If unsure, ask** — better to gate and ungrate later than give away value
4. **AI-heavy features** should respect the free tier AI budget (once defined)
5. **The autopilot pipeline is free** — that's the hook. Scale and team features are paid.
