# AI Swarm Orchestration

Parallelize development across multiple Claude Code instances, each working in its own git worktree on a separate branch. A planner decomposes work, workers implement in isolation, and a reviewer validates and merges.

## Architecture

```
Main repo (planner runs here)
  .ai/swarm/tasks.json           <- shared task queue (gitignored)
  .ai/swarm/prompts/*.md         <- role templates (committed)
  scripts/swarm/*.sh             <- spawn/teardown/status (committed)
       |
  task-toad-worker-1/            <- worktree on branch swarm/worker-1
  task-toad-worker-2/            <- worktree on branch swarm/worker-2
  task-toad-worker-3/            <- worktree on branch swarm/worker-3
  task-toad-reviewer/            <- worktree on branch swarm/reviewer
```

## Prerequisites

- Git, Node.js, pnpm installed
- `gh` CLI authenticated — run `gh auth status` to verify (reviewer needs this for PRs)
- Clean working tree on `main` — commit or stash all changes before spawning
- Enough terminal tabs or tmux panes: 1 planner + N workers + 1 reviewer

## Quick Start

### 1. Spawn the swarm

```bash
bash scripts/swarm/spawn.sh 3    # creates 3 workers + 1 reviewer
```

This creates sibling worktree directories, installs dependencies, copies `.env` files, and appends role-specific instructions to each worktree's `CLAUDE.md`.

### 2. Start the planner (main repo terminal)

```bash
cd ~/projects/task-toad
claude
```

Paste this kickoff prompt:

> You are the planner agent. Read `.ai/swarm/prompts/planner.md` for your role instructions. Plan groups J, A, and C from `.claude-knowledge/todos.md` and distribute across 3 workers. Group J should be planned first as it unblocks other groups that touch schema.ts.

### 3. Start the workers (one terminal each)

```bash
cd ~/projects/task-toad-worker-1
claude
```

Paste this kickoff prompt:

> You are a worker agent. Your role instructions are at the bottom of this CLAUDE.md file. Read the task queue and begin working on your assigned tasks.

Repeat for each worker directory.

### 4. Start the reviewer

```bash
cd ~/projects/task-toad-reviewer
claude
```

Paste this kickoff prompt:

> You are the reviewer agent. Your role instructions are at the bottom of this CLAUDE.md file. Check the task queue for completed tasks and begin reviewing.

### 5. Monitor progress

```bash
bash scripts/swarm/status.sh
```

### 6. Teardown

```bash
bash scripts/swarm/teardown.sh
```

## Task Lifecycle

```
pending -> in_progress -> completed -> review -> merged
               |                         |
            blocked              in_progress (needs fixes)
```

- **pending**: task is planned but not started
- **in_progress**: worker is actively implementing
- **completed**: worker finished, awaiting review
- **review**: reviewer is checking the work
- **merged**: squash-merged into main locally
- **blocked**: worker hit an issue (see `reviewNotes`)

## Conflict Management

Tasks are organized into groups (A-L) in `.claude-knowledge/todos.md`. Each group lists which files it touches, plus cross-group blocking relationships.

### Assignment Rules

1. **Isolate cross-group blockers** — if a task touches a shared file that other worker sets also need, isolate it (own worker or run first). Do NOT bundle it with unrelated work.
2. **Bundle safe dependents** — if task B depends only on task A (and no other worker set needs A's changes), A and B can share a worker. Test: "Would any other worker be blocked waiting?" If yes → isolate.
3. **Independent groups run in parallel** — groups with no shared files run on separate workers simultaneously.
4. **Workers only touch files in their task's `files` array** — enforced by convention, not tooling.

### Shared file hotspots

| File | Groups |
|------|--------|
| `apps/api/src/graphql/schema.ts` (typeDefs) | A, C, D, F, H, I, K |
| `apps/api/prisma/schema.prisma` | C, F, G, H, I, K |
| `apps/web/src/hooks/useProjectData.ts` | B, E, F |

See `Cross-Group Dependencies` in `.claude-knowledge/todos.md` for the full blocking matrix.

## Helper Scripts

### Task status updates

```bash
# Claim a task
bash scripts/swarm/task-update.sh task-001 in_progress --startedAt

# Mark complete
bash scripts/swarm/task-update.sh task-001 completed --completedAt

# Mark merged
bash scripts/swarm/task-update.sh task-001 merged --reviewedAt

# Send back for fixes
bash scripts/swarm/task-update.sh task-001 in_progress --reviewNotes="typecheck fails in auth.ts"

# Mark blocked
bash scripts/swarm/task-update.sh task-001 blocked --reviewNotes="need file not in list"
```

### Merge a worker branch

```bash
# Merge with validation (typecheck)
bash scripts/swarm/merge-worker.sh swarm/worker-1 --validate

# Merge without validation
bash scripts/swarm/merge-worker.sh swarm/worker-1
```

This squash-merges the worker branch into main locally. Run from any directory.

### View task statuses

```bash
bash scripts/swarm/status.sh
```

## Monitoring & Troubleshooting

### Worker is stuck

1. Check tasks.json for the task status and any `reviewNotes`
2. Set the task to `blocked`: `bash scripts/swarm/task-update.sh task-XXX blocked --reviewNotes="issue"`
3. Reassign to a different worker if necessary

### Add more tasks mid-swarm

Have the planner append new tasks to tasks.json. Use the next sequential task ID.

## Design Notes

- **No remote pushes from workers/reviewer** — only the user pushes from main when ready
- **Workers loop until done** — workers auto-rebase before each task, self-fix on review feedback, and loop until all their tasks are `merged`
- **Local merges** — the reviewer squash-merges worker branches into main locally (no PRs)
- **Helper scripts minimize approvals** — `task-update.sh` and `merge-worker.sh` replace inline `node -e` and cross-directory `git` commands

## Limitations

- **No automatic orchestration** — you manually open terminals and start each Claude Code instance
- **File-based coordination without locking** — works because agents are slow (minutes between writes) and each only modifies its own task status fields
- **Workers must not touch files outside their task's `files` array** — enforced by convention
- **One swarm at a time** — single tasks.json file
