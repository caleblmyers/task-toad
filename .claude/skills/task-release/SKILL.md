---
name: task-release
description: Validate, push, and verify deployment after a swarm wave cleanup. Runs tests, pushes to remote, monitors CI, and checks production health. Use when the user says "release", "push and verify", or "deploy wave".
disable-model-invocation: false
user-invocable: true
---

# Release Wave

You are the release agent. Run this after `/task-cleanup` has completed (all tasks merged, worktrees torn down, docs updated). Your job is to validate, push, and verify the deployment.

## 1. Pre-push Validation

Run ALL checks — including tests (which the reviewer doesn't run locally):

```bash
cd apps/api && npx prisma validate
```
```bash
pnpm typecheck
```
```bash
pnpm lint
```
```bash
pnpm build
```
```bash
pnpm test
```

If ANY check fails, report the specific error and stop. Do NOT push broken code.

## 2. Check Git State

```bash
git status
```
If dirty, warn the user and stop — there shouldn't be uncommitted changes after cleanup.

```bash
git log --oneline origin/main..HEAD
```
Show the user what commits will be pushed. Confirm the count matches expectations.

```bash
git worktree list
```
If any worktrees besides main exist, warn — teardown may not have completed.

## 3. Push

```bash
git push origin main
```

If push fails (e.g., rejected due to remote changes), report and stop. Do NOT force push.

## 4. Monitor CI

After push, GitHub Actions CI runs automatically. Monitor it:

```bash
gh run list --branch main --limit 1
```

Get the run ID and watch it:
```bash
gh run watch <run-id>
```

If `gh` is not available or fails, instruct the user to check GitHub Actions manually and report back.

**Expected CI pipeline:** lint → typecheck → test (unit + integration) → build → deploy (if enabled) → smoke test.

If CI fails:
- Identify the specific failing step and error
- Report to the user with the error details
- Suggest: "Fix the issue, commit, and re-run `/task-release`"
- Do NOT attempt to fix CI failures yourself

## 5. Verify Deployment (if applicable)

If the deploy workflow ran (check for a deploy job in the CI run):

```bash
gh run view <run-id> --json jobs --jq '.jobs[] | select(.name | contains("deploy")) | {name, status, conclusion}'
```

If deploy succeeded and a production URL is known, run a health check:
```bash
curl -sf https://<production-url>/api/health | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('Status:', d.status, '| DB:', d.db, '| Uptime:', Math.round(d.uptime)+'s')"
```

If no production URL is configured or deploy is disabled, skip this step and note it.

## 6. Report

Format the output clearly:

```
## Release Report — Wave N

| Check | Status |
|-------|--------|
| Prisma validate | ✓ Pass |
| TypeScript | ✓ Pass |
| Lint | ✓ Pass |
| Build | ✓ Pass |
| Tests | ✓ Pass |
| Push | ✓ N commits pushed |
| CI Pipeline | ✓ All jobs passed |
| Deploy | ✓ Health OK / ⚠ Not configured / ✗ Failed |

### Commits pushed (N):
[list of commit messages]

### Verdict
✓ Wave N released successfully — all checks pass, CI green, deploy healthy.
OR
✗ Release blocked — [specific failure]
```
