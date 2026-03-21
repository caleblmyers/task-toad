---
name: task-release
description: Complete post-swarm cleanup and release — verify tasks, tear down worktrees, validate build + runtime, update docs, push, monitor CI, and verify production deploy with version check. Use when the user says "release", "push and verify", "deploy wave", "cleanup and release".
disable-model-invocation: false
user-invocable: true
---

# Release Wave

You are the release agent. Your job is to clean up after a swarm wave, validate everything (including runtime), update documentation, push, and verify the deployment. This is a single end-to-end flow — no separate cleanup step needed.

## 1. Verify Task Completion

Read `.ai/taskswarm/tasks.json` and check all task statuses:
```bash
cat .ai/taskswarm/tasks.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.tasks.forEach(t => console.log(t.id, t.status.padEnd(12), t.assignee.padEnd(10), t.title.slice(0,65)))"
```

- If any tasks are NOT `merged`, report which ones and stop — the wave isn't done yet.
- If all tasks are `merged`, proceed.

## 2. Check for Leftover Issues

- Look for files that shouldn't exist (e.g., leftover `prisma/schema.prisma` alongside `prisma/schema/`)
- Run `git status` to check for uncommitted changes from the reviewer
- Check `.ai/taskswarm/issues.md` for any process issues logged by workers/reviewer — summarize them for the user

## 3. Tear Down Worktrees

Check if worktrees exist beyond main:
```bash
git worktree list
```

If swarm worktrees exist, tear them down:
```bash
bash scripts/taskswarm/teardown.sh
```

Verify cleanup — only the main worktree should remain.

## 4. Pre-push Validation

Run ALL checks from the repo root:

```bash
cd apps/api && npx prisma validate   # Prisma schema valid
```
```bash
pnpm typecheck                        # TypeScript passes
```
```bash
pnpm lint                             # Lint passes
```
```bash
pnpm build                            # Production build succeeds
```
```bash
pnpm test                             # All tests pass
```

### Runtime Smoke Test (CRITICAL)

After `pnpm build` succeeds, verify the compiled server actually starts:

```bash
cd apps/api && node dist/index.js &
BGPID=$!
sleep 3
HEALTH=$(curl -sf http://localhost:3001/api/health 2>&1) || HEALTH="FAILED"
kill $BGPID 2>/dev/null
wait $BGPID 2>/dev/null
echo "$HEALTH"
```

- If the server fails to start (crash, import error, missing module), report the error and stop.
- This catches ESM/CJS import issues, missing packages, and other runtime-only errors that `tsc` doesn't detect.
- If port 3001 is already in use (e.g., dev server running), warn the user and skip this check — do NOT kill unknown processes.

If ANY check fails:
- Identify the specific error
- Report it to the user — do NOT attempt to fix it
- Stop until the user decides how to proceed

## 5. Update Documentation

- Read `.claude-knowledge/todos.md`
- Move completed sets from "Remaining" to "Completed" section
- Mark items as `[x]` with the wave number and date
- **Add follow-up items as new todos:** Read `issues.md` and the changelog for any incomplete work, unfinished wiring, or gaps discovered during the wave. Add each as a `- [ ]` item under the appropriate work set in todos.md.
- **Verify follow-ups are in todos:** Before committing, grep todos.md for each open follow-up mentioned in issues.md or the changelog. If any are missing, add them. This is the critical step — follow-ups that don't become todos get lost.
- Update the Parallelism Matrix if set relationships changed
- Update `.claude-knowledge/changelog.md` if it exists — add a summary of what was done, including an "Open follow-ups" section listing items that need future work

## 6. Update App Docs (if wave changed the data model, auth, or file structure)

Check if this wave added/changed Prisma models, auth flow, API endpoints, or major file structure. If so:

- **`README.md`** — Update the env vars table, setup instructions, usage steps, or security section if any changed.
- **`.claude-knowledge/app-overview.md`** — Update the data model list, auth flow, request path, GraphQL operations, or file map if any changed.

Skip this step if the wave was purely frontend, cleanup, or documentation changes.

## 7. Commit Documentation

Stage and commit the documentation updates:
```bash
git add .claude-knowledge/todos.md .claude-knowledge/changelog.md .ai/taskswarm/issues.md
```

Also stage `README.md` and `app-overview.md` if they were updated in step 6.

Use Conventional Commits format:
```
chore(docs): update todos and changelog after Wave N completion

- Mark [sets] as completed
- [summary of issues.md if any]

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## 8. Check Git State

```bash
git status
```
If dirty after the docs commit, warn and stop.

```bash
git log --oneline origin/main..HEAD
```
Show the user what commits will be pushed. Record the **HEAD commit SHA** — you'll need it for version verification later.

## 9. Push

```bash
git push origin main
```

If push fails (e.g., rejected due to remote changes), report and stop. Do NOT force push.

## 10. Monitor CI

After push, GitHub Actions CI runs automatically. Monitor it:

```bash
gh run list --branch main --limit 1
```

Get the run ID and watch it:
```bash
gh run watch <run-id>
```

If CI fails:
- Identify the specific failing step and error
- Report to the user with the error details
- Suggest: "Fix the issue, commit, and re-run `/task-release`"
- Do NOT attempt to fix CI failures yourself

## 11. Monitor Deploy

Wait for the deploy workflow to trigger:
```bash
gh run list --branch main --limit 2 --json databaseId,name,status,conclusion
```

Watch the deploy run:
```bash
gh run watch <deploy-run-id>
```

Check the deploy trigger wasn't skipped:
```bash
gh run view <deploy-run-id> --json jobs --jq '.jobs[] | select(.name == "deploy") | .steps[] | {name, conclusion}'
```

If the "Trigger Railway deploy" step shows `skipped`, report this to the user — it means `RAILWAY_DEPLOY_ENABLED` is not set to `true` in GitHub repo variables. The code was pushed but NOT deployed.

## 12. Verify Deployment with Version Check (CRITICAL)

Run a health check that verifies the deployed **version matches the commit just pushed**:

```bash
curl -sf https://tasktoad-api-production.up.railway.app/api/health | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Status:', d.status, '| DB:', d.db, '| Version:', d.version, '| Uptime:', Math.round(d.uptime)+'s');
  if (d.version === 'dev') {
    console.log('WARNING: Version is dev — GIT_COMMIT_SHA not set in production env');
  }
"
```

**Version verification:** Compare the `version` field from the health check against the HEAD commit SHA you recorded in step 8. Use:

```bash
git rev-parse HEAD
```

- If versions match → deploy confirmed
- If version is `dev` → warn that `RAILWAY_GIT_COMMIT_SHA` / `GIT_COMMIT_SHA` is not set in Railway
- If version is a different SHA → the deploy did NOT pick up the latest push. Report as a deploy failure.
- If uptime is very high (> 5 minutes since push) AND version doesn't match → the Railway build likely failed. Report this explicitly.

## 13. Report

Format the output clearly:

```
## Release Report — Wave N

| Check | Status |
|-------|--------|
| Tasks merged | ✓ All N tasks |
| Worktree teardown | ✓ Clean |
| Prisma validate | ✓ Pass |
| TypeScript | ✓ Pass |
| Lint | ✓ Pass |
| Build | ✓ Pass |
| Runtime smoke test | ✓ Server starts and responds |
| Tests | ✓ Pass (N tests) |
| Docs updated | ✓ Committed |
| Push | ✓ N commits pushed |
| CI Pipeline | ✓ All jobs passed |
| Deploy trigger | ✓ Railway triggered / ⚠ Skipped |
| Version verified | ✓ <short-sha> matches HEAD / ✗ Mismatch |
| Deploy health | ✓ OK (uptime Ns) / ✗ Failed |

### Commits pushed (N):
[list of commit messages]

### Verdict
✓ Wave N released successfully — all checks pass, CI green, deploy verified at <short-sha>.
OR
✗ Release blocked — [specific failure]
```

Do NOT push to remote until all pre-push checks pass. The entire flow is: verify → teardown → validate → docs → push → CI → deploy → verify version.
