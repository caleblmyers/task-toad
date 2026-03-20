---
name: test-swarm
description: Spawn a test swarm — 3 testers + 1 debugger that find and fix bugs against the live server. Use when the user says "test swarm", "find bugs", "qa sweep", or "start testers".
user-invocable: true
---

# Spawn Test Swarm

Set up a test swarm with tester agents that find bugs and debugger agents that fix them.

## Prerequisites

1. Verify dev server is running:
```bash
curl -s --max-time 5 http://localhost:3001/api/health | jq .status
```
If not running, tell the user to start it with `pnpm dev` first.

2. Verify clean git state:
```bash
git status --short
git worktree list
```

## Spawn

```bash
bash scripts/testswarm/spawn.sh 3 1
```

This creates:
- Bug queue at `.ai/bugs/bugs.json`
- 1 debugger worktree at `~/projects/task-toad-debugger-1`
- Testers run from main repo (read-only, no worktree needed)

## Output Prompts

All agents use `--dangerously-skip-permissions` since testers are read-only (curl only) and the debugger works in an isolated worktree. This is safe for localhost testing.

Show the user these commands to run in separate terminals:

### Tester 1 — API/GraphQL
```bash
cd ~/projects/task-toad && claude --dangerously-skip-permissions -p "/test-worker api"
```

### Tester 2 — UI Flows
```bash
cd ~/projects/task-toad && claude --dangerously-skip-permissions -p "/test-worker ui"
```

### Tester 3 — Edge Cases
```bash
cd ~/projects/task-toad && claude --dangerously-skip-permissions -p "/test-worker edge"
```

### Debugger 1
```bash
cd ~/projects/task-toad-debugger-1 && claude --dangerously-skip-permissions -p "/test-debugger"
```

## Teardown

When done:
```bash
bash scripts/testswarm/teardown.sh
```
Then review the debugger's fixes and merge to main.
