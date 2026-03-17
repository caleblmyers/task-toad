---
name: test-cleanup
description: Wait for test swarm agents to finish, review debugger fixes, tear down worktrees, and update error docs. Use when the user says "test cleanup", "testers done", "cleanup test swarm", or "merge debugger fixes".
user-invocable: true
---

# Test Swarm Cleanup

You are cleaning up after a test swarm. Follow these steps precisely.

## 1. Wait for Agents to Finish

Poll every 30 seconds until all tester and debugger agents are done. An agent is "still running" if it has a `claude` process whose cwd is either the main repo or a debugger worktree.

Check with:
```bash
# Find claude processes in task-toad or task-toad-debugger-* directories
ps aux | grep -E '[c]laude' | grep -E 'task-toad' || echo "NO_AGENTS_RUNNING"
```

Also check the bug queue for activity — if bugs are still `open` and a debugger is running, the debugger is likely still working:
```bash
cat .ai/bugs/bugs.json
```

**Decision logic per poll iteration:**
- If `NO_AGENTS_RUNNING` → all agents are done, proceed to Step 2.
- If agents are running → report which agents are still active (tester vs debugger, based on cwd), show current bug counts, then sleep 30s and re-check.
- **Safety cap:** After 30 minutes of polling (60 iterations), stop waiting and ask the user whether to proceed anyway or keep waiting.

Print a brief status line each poll cycle:
```
[HH:MM:SS] Waiting — 2 agents running, 5 bugs found (3 fixed, 2 open)
```

## 2. Review Bug Queue

Read `.ai/bugs/bugs.json` and summarize:
- Total bugs found
- Bugs by status (fixed, wont-fix, duplicate, open)
- If any bugs are still `open` with no debugger running, warn the user and ask whether to proceed or investigate.

## 3. Review Debugger Fixes

Check the debugger worktree(s) for changes:
```bash
git worktree list
```

For each debugger worktree (e.g., `~/projects/task-toad-debugger-1`):
```bash
git -C ~/projects/task-toad-debugger-1 log --oneline main..HEAD
git -C ~/projects/task-toad-debugger-1 diff --stat main..HEAD
```

Show the user a summary of what the debugger changed. If there are no changes, note that.

## 4. Validate Debugger Builds

For each debugger worktree with changes, verify the code is sound:
```bash
cd ~/projects/task-toad-debugger-1 && pnpm typecheck && pnpm lint && pnpm build
```

If ANY check fails:
- Report the specific error
- Ask the user whether to skip this debugger's changes or attempt to fix

## 5. Merge Debugger Fixes

For each debugger worktree that passed validation:
```bash
git merge testswarm/debugger-1 --no-ff -m "fix: merge test swarm debugger-1 fixes"
```

If merge conflicts occur:
- Report the conflicting files
- Ask the user how to proceed — do NOT auto-resolve

After merging, re-validate from main:
```bash
pnpm typecheck && pnpm lint && pnpm build
```

## 6. Tear Down Worktrees

```bash
bash scripts/testswarm/teardown.sh
```

Verify cleanup:
```bash
git worktree list
```
Should only show the main worktree.

## 7. Clean Up Test Data

Delete all test entities created by testers from the local database:
```bash
cd apps/api && npx tsx ../../scripts/testswarm/cleanup-test-data.ts
```

This reads `.ai/bugs/test-data.json` (populated by testers during the swarm) and deletes all tracked users, orgs, projects, tasks, sprints, comments, labels, webhooks, and Slack integrations in the correct dependency order.

If the script fails:
- Report the error — it's usually a FK constraint the script didn't handle
- Ask the user whether to skip DB cleanup or investigate

## 8. Update Error Documentation

Read `.claude-knowledge/errors.md` and update it with any new errors discovered during testing:
- Add new entries for bugs that revealed previously undocumented errors
- Include the root cause and fix for each
- Skip duplicates of existing entries

## 9. Report

Show the user:
- Bugs found / fixed / remaining
- Commits merged from debugger(s)
- Any bugs marked `wont-fix` or left `open` that need follow-up
- Validation status (typecheck/lint/build)
- Confirmation: "Test swarm cleanup complete"
