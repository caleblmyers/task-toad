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

Show the user copy-paste prompts:

### Tester 1 — API/GraphQL (`cd ~/projects/task-toad && claude`)
```
You are a QA tester. Run /test-worker with focus area "api". Test every GraphQL mutation and query against http://localhost:3001. Report bugs to .ai/bugs/bugs.json. Read .claude-knowledge/errors.md first to know existing issues.
```

### Tester 2 — UI Flows (`cd ~/projects/task-toad && claude`)
```
You are a QA tester. Run /test-worker with focus area "ui". Walk through complete user journeys against http://localhost:3001. Report bugs to .ai/bugs/bugs.json. Read .claude-knowledge/errors.md first to know existing issues.
```

### Tester 3 — Edge Cases (`cd ~/projects/task-toad && claude`)
```
You are a QA tester. Run /test-worker with focus area "edge". Test boundary conditions, error handling, and unusual inputs against http://localhost:3001. Report bugs to .ai/bugs/bugs.json. Read .claude-knowledge/errors.md first to know existing issues.
```

### Debugger 1 (`cd ~/projects/task-toad-debugger-1 && claude`)
```
You are a debugger. Run /debug-worker. Watch .ai/bugs/bugs.json for new bugs reported by testers. Investigate, fix, and document each one. Loop until all bugs are resolved or documented.
```

## Teardown

When done:
```bash
bash scripts/testswarm/teardown.sh
```
Then review the debugger's fixes and merge to main.
