# Production Test Checklist

Comprehensive manual test plan for `tasktoad.app`. Test with a fresh account (new email) to simulate a real user's first experience.

---

## 1. Signup & Auth Flow

- [ ] Visit `tasktoad.app` — landing page loads, looks correct
- [ ] Click "Sign Up" — signup form appears
- [ ] Sign up with a fresh email — success message shown
- [ ] Verification email arrives (check inbox + spam)
- [ ] Click verification link — auto-login, redirected to create org
- [ ] Try logging in without verifying — blocked with "verify your email" message
- [ ] Click "Resend verification email" on login page — email arrives
- [ ] Log out → log back in — works without issues
- [ ] Forgot password flow — email arrives, reset works, can log in with new password

## 2. Org Creation & Trial

- [ ] Create org with a name — org created, redirected to home
- [ ] Verify org is on Pro trial — Settings → Billing shows "Pro trial: X days remaining"
- [ ] All premium features accessible during trial (check for no license errors)

## 3. Project Setup — New Project (Scaffold)

- [ ] Create new project with name + description
- [ ] Project setup wizard appears
- [ ] Connect GitHub — install GitHub App, select installation
- [ ] Create new repo via TaskToad — repo appears on GitHub
- [ ] AI stack recommendation loads — shows recommendation + alternatives
- [ ] Select a stack and scaffold — progress events shown (not just spinner)
- [ ] Scaffold commits to GitHub repo — check GitHub for commits
- [ ] Repo has `CLAUDE.md` and `.claude-knowledge/` files (AI-friendly scaffolding)
- [ ] Knowledge base auto-populated from scaffold files

## 4. Project Setup — Existing Repo

- [ ] Create another project
- [ ] Connect an existing GitHub repo (instead of creating new)
- [ ] Enter project intent in the textarea
- [ ] Click "Analyze Repository" — progress events shown
- [ ] Bootstrap creates project profile + initial tasks
- [ ] "Generate detailed plan" button appears after bootstrap
- [ ] Click it — HierarchicalPlanDialog opens with intent pre-populated

## 5. Hierarchical Plan Generation

- [ ] Enter a planning prompt (or use pre-populated one)
- [ ] Click generate — real SSE progress events shown (not fake cycling messages)
- [ ] Plan loads with epics and tasks
- [ ] Decision tasks show selectable options with recommendations highlighted
- [ ] Dependencies shown between tasks with reasons
- [ ] Select options for all decision tasks
- [ ] Commit the plan — epics and tasks created
- [ ] Task dependencies visible in task detail (Blocked by / Blocks sections)

## 6. Plan Refinement

- [ ] Open hierarchical plan editor
- [ ] Select tasks via checkboxes (epic-level selection works)
- [ ] Click "Refine selected" — enter refinement prompt
- [ ] Diff view shows changes (green for new, amber for modified)
- [ ] Accept refinement — tasks updated
- [ ] Discard refinement — reverts to originals

## 7. Task Detail & Board Views

- [ ] Open a task — detail panel shows all fields
- [ ] Edit task title, description, priority, status — saves correctly
- [ ] Add/remove labels, assignees
- [ ] Dependencies section shows blockedBy/blocks with link type badges and reason tooltips
- [ ] Kanban board view — columns scroll when tasks overflow
- [ ] Swimlanes enabled — individual swimlane sections scroll independently
- [ ] Drag task between columns — status updates
- [ ] Column reorder via drag — persists
- [ ] Board horizontal scroll works on narrow viewport (mobile)
- [ ] Close sprint from board view toolbar — CloseSprintModal opens

## 8. Auto-Complete (Action Plan Pipeline)

- [ ] Open a task with instructions
- [ ] Click "Auto-Complete" — button shows "Planning..." (not full description text)
- [ ] Action plan preview dialog appears
- [ ] Approve the plan — execution starts
- [ ] ActionProgressPanel shows live progress via SSE
- [ ] AI review comments collapsed by default (expandable)
- [ ] If plan fails — auto-replan triggers (up to 2 retries)
- [ ] Concurrent plan prevention — try starting a second plan on same project → blocked with message

## 9. Quick Start (Session Autopilot)

- [ ] Go to Execution Dashboard
- [ ] Pipeline overview stat cards visible (Todo, Executing, Done, etc.)
- [ ] Click "Quick Start" — confirmation dialog shows task count
- [ ] Confirm — session starts, orchestrator picks first task
- [ ] Session banner shows progress (tasks completed, cost)
- [ ] Tasks execute in dependency order (blocked tasks wait)
- [ ] Pause/cancel session works

## 10. GitHub Integration

- [ ] PR created on GitHub by TaskToad — commits attributed to TaskToad[bot] (not user)
- [ ] PR body has `tasktoad.app` link (not `tasktoad.dev`)
- [ ] Review comments posted on PR by TaskToad bot
- [ ] Merge PR externally on GitHub — task status updates in TaskToad
- [ ] CI pass/fail reflected via webhook (check if events show in UI)

## 11. Billing & Limits

- [ ] Settings → Billing tab shows current plan and trial status
- [ ] Free plan (after trial): create 4th project → blocked with upgrade message
- [ ] Free plan: invite 4th member → blocked with upgrade message
- [ ] Free plan: concurrent execution limited to 1 task
- [ ] Upgrade prompt visible in ExecutionDashboard when concurrent limit hit
- [ ] Click "Upgrade to Pro" → Stripe Checkout page loads
- [ ] Complete checkout with test card `4242 4242 4242 4242` → redirected back, plan shows Pro
- [ ] "Manage Subscription" → Stripe billing portal opens
- [ ] After upgrade: 4th project creation works, parallel execution works

## 12. Knowledge Base

- [ ] Project KB panel — shows auto-seeded entries from scaffold/bootstrap
- [ ] Add manual KB entry — saves correctly
- [ ] Org-level KB — Settings → Knowledge Base tab
- [ ] Add org-level entry — appears in org KB
- [ ] Org KB entries included in AI prompts (check plan output references org context)

## 13. Health Monitoring & Notifications

- [ ] Notification bell shows unread count
- [ ] Mark notifications as read
- [ ] If a plan gets stuck (>30 min), health alert notification should appear
- [ ] SSE leader indicator visible in dev mode only (bottom-right corner)

## 14. Real-Time Updates (SSE)

- [ ] Open two browser tabs on the same project
- [ ] Create a task in one tab — appears in the other tab without refresh
- [ ] Update task status in one tab — reflected in the other
- [ ] Only one tab should maintain SSE connection (leader election)
- [ ] Close the leader tab — other tab promotes itself and reconnects

## 15. Misc UX

- [ ] PriorityDropdown — keyboard navigation works (arrow keys, Escape, Enter)
- [ ] Release notes — manual entry textarea available
- [ ] Time entry deletion — only admin or creator can delete (others get error)
- [ ] Dark mode — all UI elements render correctly
- [ ] Browser doesn't prompt to save password on API key input

---

## Test Accounts Needed

- Fresh email for signup flow testing
- Existing account (`clincolnmyers@gmail.com`) for feature testing
- Second account for multi-user/tenant isolation testing

## Known Issues to Watch For

- Email delivery via Resend — `cmyers5108@gmail.com` wasn't receiving verification emails (investigate SMTP config)
- Stripe is on sandbox keys — test card only, no real charges
- PostgreSQL must be running for integration tests (CI has its own DB)
