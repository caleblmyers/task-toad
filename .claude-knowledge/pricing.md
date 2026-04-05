# TaskToad — Pricing & Features

**All features are free.** TaskToad is an open source portfolio project, not a commercial SaaS.

_Updated 2026-04-04: Premium plans cancelled. GitHub's agent features (Copilot Coding Agent, /fleet, Mission Control) cover the same space with 100M+ user distribution. See `competitive-analysis-github-2026-04.md` in the brain repo for the full analysis._

---

## What Users Get (everything, no limits)

- Full autopilot pipeline (plan → execute → review → merge → next task)
- Parallel execution (up to 3 concurrent tasks)
- All team features (roles, approvals, SLAs, field permissions)
- All integrations (Slack, cron automations)
- Initiatives / portfolio management
- Org + project knowledge base
- Unlimited projects, unlimited team members
- BYOK (users provide their own Anthropic API key)

## What's in the Code

The `requireLicense()` checks and Stripe integration remain in the codebase as demonstration of billing engineering. They are disabled — all users get the `paid` plan features regardless of their org plan setting.

| Component | Status |
|-----------|--------|
| `requireLicense()` checks | Removed — all features accessible |
| Stripe checkout/webhooks/portal | Code exists but UI hidden |
| `useLicenseFeatures()` hook | Returns all features for all plans |
| Free tier limits (3 projects, 3 members) | Removed |
| 14-day trial | Removed — new orgs get full access |

## Rules for Development

1. **No feature gating** — everything is free
2. **Keep Stripe code** — demonstrates billing knowledge, don't delete it
3. **Focus on demo quality** — the app should work well enough to show in interviews
4. **Don't invest in new features** — wrap up, polish, move on
