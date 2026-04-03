# TaskToad — Pricing & Feature Tiers

This document defines what's free, what's premium, and what's planned. **Read this before adding features** — don't give away premium features on the free plan.

---

## Pricing Philosophy

- **Free tier is generous enough to be useful** — a solo developer can run their project autopilot with real value
- **Paid tier unlocks scale and team features** — parallel execution, team roles, integrations, SLAs
- **The moat is the pipeline, not the PM dashboard** — free users get the autopilot (sequentially), paid users get it at scale
- **Users bring their own API key** — TaskToad doesn't pay AI costs, so no AI usage limits needed
- **Per-org pricing** — one subscription covers the whole org, encourages team adoption

---

## Pricing

| | Free | Pro |
|--|------|-----|
| **Price** | $0 forever | **$19/mo** per org (or **$190/year** — 2 months free) |
| **Projects** | 3 | Unlimited |
| **Team members** | 3 | Unlimited |
| **Concurrent execution** | 1 task at a time | 3 parallel streams |
| **Trial** | — | 14 days free for new orgs |

**Billing unit:** Per org, not per seat. All members in the org get Pro features when the org subscribes.

**AI costs:** Users provide their own Anthropic API key. TaskToad doesn't meter or charge for AI usage.

---

## Free Plan

Everything a solo developer or small team needs to use TaskToad as an autopilot:

### Core Autopilot (the product)
- **AI planning** — hierarchical plan generation with decision points, dependency inference, feedback loop, iterative refinement
- **AI code generation** — Auto-Complete with full pipeline (generate → PR → review → fix → merge)
- **Session execution** — Quick Start autopilot (sequential, 1 task at a time)
- **Auto-replan on failure** — up to 2 retries with failure context
- **CI monitoring + fix_ci recovery** — webhook-driven CI status
- **Real-time progress** — SSE events, pipeline dashboard, action progress
- **Health monitoring** — stuck plan + stale PR detection with notifications

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
- Event-based automations

### Limits
- **3 projects** per org
- **3 team members** per org
- **1 concurrent task** execution (sequential autopilot only)

---

## Pro Plan — $19/mo per org

Everything in Free, plus:

### Scale
- **Parallel execution** — up to 3 concurrent tasks in autopilot sessions
- **Unlimited projects**
- **Unlimited team members**

### Team & Workflow
- **Project roles** — viewer/editor/admin per project
- **Field permissions** — role-based access to specific fields
- **Approval workflows** — task transition approvals
- **SLA policies** — response/resolution timers with breach detection

### Integrations
- **Slack integration** — webhooks, user mappings, notifications
- **Cron automations** — scheduled automation rules (event-based automations are free)

### Portfolio
- **Initiatives** — cross-project portfolio tracking

---

## Currently Gated (in code)

| Feature | Code Key | Resolver | Status |
|---------|----------|----------|--------|
| Slack | `slack` | slack.ts | ✅ Gated |
| Initiatives | `initiatives` | initiative.ts | ✅ Gated |
| SLA policies | `sla` | sla.ts | ✅ Gated |
| Approvals | `approvals` | approval.ts | ✅ Gated |
| Cron automations | `cron_automations` | projectrole.ts | ✅ Gated |
| Field permissions | `field_permissions` | fieldpermission.ts | ✅ Gated |
| Project roles | `project_roles` | projectrole.ts | ✅ Gated |
| Parallel execution | `parallel_execution` | orchestratorListener.ts | ✅ Gated (limit-based) |

Frontend gating: `useLicenseFeatures()` hook checks `orgPlan` and conditionally renders premium UI.

### Limits (enforced in Wave 91)

| Limit | Status |
|-------|--------|
| Project count (3 free) | ✅ Enforced in `createProject` resolver |
| Team size (3 free) | ✅ Enforced in `inviteOrgMember` resolver |
| 14-day Pro trial | ✅ Auto-set on org creation, checked by `getEffectivePlan()` |

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Org plan field (`free`/`paid`) | ✅ In DB |
| `requireLicense()` checks | ✅ 8 features gated |
| `useLicenseFeatures()` frontend hook | ✅ Hides premium UI |
| `updateOrgPlan` mutation | ✅ Admin-only |
| Project count limit (free: 3) | ✅ Enforced (Wave 91) |
| Team size limit (free: 3) | ✅ Enforced (Wave 91) |
| 14-day Pro trial | ✅ Auto-set on org creation (Wave 91) |
| Stripe integration | ✅ Checkout + webhooks + portal (Wave 91) |
| Payment flow (subscribe/cancel) | ✅ Stripe Checkout redirect (Wave 91) |
| Billing portal (manage subscription) | ✅ Stripe portal redirect (Wave 91) |
| Annual billing option ($190/yr) | ✅ Monthly/annual toggle in UI (Wave 91) |
| Upgrade prompts in UI | ✅ UpgradePrompt component + billing tab (Wave 91) |

---

## Stripe Integration Plan

### Products to Create
- **TaskToad Pro Monthly** — $19/mo recurring
- **TaskToad Pro Annual** — $190/yr recurring (save $38)

### Flow
1. User clicks "Upgrade to Pro" in org settings
2. Redirect to Stripe Checkout with org ID in metadata
3. Stripe webhook (`checkout.session.completed`) updates `org.plan = 'paid'`
4. Stripe webhook (`customer.subscription.deleted`) downgrades `org.plan = 'free'`
5. Billing portal link in org settings for managing subscription

### Env Vars Needed
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_ANNUAL_PRICE_ID`

---

## Future Pricing Considerations

- **Advanced analytics tier** — if trend analysis, Monte Carlo, cycle time analytics prove valuable, consider gating behind Pro
- **Enterprise tier** — SSO, audit logs, custom contracts. Build when there's demand.
- **Usage-based add-on** — if some orgs run massive parallel sessions, consider usage-based pricing on top of Pro
- **Per-seat pricing** — revisit if large teams (10+) start subscribing at $19 flat

---

## Rules for Development

1. **Never add premium features to the free plan** — check this doc before implementing
2. **New features default to free** unless they're in the "Pro Plan" section above
3. **If unsure, ask** — better to gate and ungrate later than give away value
4. **The autopilot pipeline is free** — that's the hook. Scale and team features are paid
5. **Pro limits (projects, members) must be enforced in resolvers** — not just frontend
6. **Upgrade prompts** should appear naturally when users hit limits, not as popups/nags
