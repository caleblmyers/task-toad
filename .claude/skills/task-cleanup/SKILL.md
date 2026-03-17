---
name: task-cleanup
description: Verify a completed swarm wave, validate builds, tear down worktrees, update todos, and commit. Use when the user says "cleanup swarm", "wave is done", "verify and teardown", or "ensure ready to push".
disable-model-invocation: false
user-invocable: true
---

# Swarm Wave Cleanup

You are cleaning up after a completed swarm wave. Follow these steps precisely.

## 1. Verify Task Completion

Read `.ai/taskswarm/tasks.json` and check all task statuses:
```bash
cat .ai/taskswarm/tasks.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.tasks.forEach(t => console.log(t.id, t.status.padEnd(12), t.assignee.padEnd(10), t.title.slice(0,65)))"
```

- If any tasks are NOT `merged`, report which ones and stop — the wave isn't done yet.
- If all tasks are `merged`, proceed.

## 2. Validate Build

Run ALL validation checks from the repo root:
```bash
cd apps/api && npx prisma validate   # Prisma schema valid
```
```bash
pnpm typecheck                        # TypeScript passes
```
```bash
pnpm build                            # Production build succeeds
```
```bash
pnpm lint                             # Lint passes (if configured)
```

If ANY check fails:
- Identify the specific error
- Report it to the user — do NOT attempt to fix it (it should have been caught by the reviewer)
- Stop until the user decides how to proceed

## 3. Check for Leftover Issues

- Look for files that shouldn't exist (e.g., leftover `prisma/schema.prisma` alongside `prisma/schema/`)
- Run `git status` to check for uncommitted changes from the reviewer
- Check `.ai/taskswarm/issues.md` for any process issues logged by workers/reviewer — summarize them for the user

## 4. Tear Down Worktrees

```bash
bash scripts/taskswarm/teardown.sh
```

Verify cleanup:
```bash
git worktree list
```
Should only show the main worktree.

## 5. Update Documentation

- Read `.claude-knowledge/todos.md`
- Move completed sets from "Remaining" to "Completed" section
- Mark items as `[x]` with the wave number and date
- **Add follow-up items as new todos:** Read `issues.md` and the changelog for any incomplete work, unfinished wiring, or gaps discovered during the wave. Add each as a `- [ ]` item under the appropriate work set in todos.md. Common examples: background processors not wired into entry points, templates built but not called, features blocked on prerequisites. If no existing set fits, add to the most relevant one.
- **Verify follow-ups are in todos:** Before committing, grep todos.md for each open follow-up mentioned in issues.md or the changelog. If any are missing, add them. This is the critical step — follow-ups that don't become todos get lost.
- Update the Parallelism Matrix if set relationships changed
- Update `.claude-knowledge/changelog.md` if it exists — add a summary of what was done, including an "Open follow-ups" section listing items that need future work

## 6. Commit

Stage and commit the documentation updates:
```bash
git add .claude-knowledge/todos.md .claude-knowledge/changelog.md .ai/taskswarm/issues.md
```

Use Conventional Commits format:
```
chore(docs): update todos and changelog after Wave N completion

- Mark [sets] as completed
- [summary of issues.md if any]

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## 7. Report

Show the user:
- Number of commits ahead of origin (`git log --oneline origin/main..HEAD`)
- Summary of what was built in this wave
- Any issues from `.ai/taskswarm/issues.md` that need attention
- Confirmation: "Ready to `git push`"
