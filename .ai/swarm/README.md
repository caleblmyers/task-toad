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
- **merged**: PR merged into main
- **blocked**: worker hit an issue (see `reviewNotes`)

## Conflict Management

Tasks are organized into groups (A-L) in `.claude-knowledge/todos.md`. Each group lists which files it touches. The key rules:

1. **All tasks from the same group go to the same worker** — this preserves the conflict-free guarantee within a group.
2. **Groups that share files are serialized via `dependsOn`** — the planner sets these dependencies.
3. **Group J (schema split) should run first** — 8 of 12 groups touch `schema.ts`. Splitting it into modules first unblocks true parallelism.
4. **Workers only touch files in their task's `files` array** — this is enforced by convention, not tooling.

### Shared file hotspots

| File | Groups |
|------|--------|
| `apps/api/src/graphql/schema.ts` | A, C, D, F, H, I, J, K |
| `apps/api/prisma/schema.prisma` | B, C, F, G, H, I |
| `apps/web/src/hooks/useProjectData.ts` | B, E, F |

## Monitoring & Troubleshooting

### View task statuses

```bash
bash scripts/swarm/status.sh
```

### Manually edit tasks.json

The task queue is plain JSON. You can edit it directly:

```bash
# Reassign a task
node -e "
const fs = require('fs');
const f = '.ai/swarm/tasks.json';
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
d.tasks.find(t => t.id === 'task-003').assignee = 'worker-2';
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
"
```

### Worker is stuck

1. Check tasks.json for the task status and any `reviewNotes`
2. Set the task to `blocked` with a note if needed
3. Reassign to a different worker if necessary

### Add more tasks mid-swarm

Have the planner append new tasks to tasks.json. Use the next sequential task ID.

### Worker needs to rebase after a merge

```bash
cd ~/projects/task-toad-worker-N
git fetch origin main
git rebase origin/main
```

The reviewer will add `reviewNotes` to pending tasks when a rebase is needed.

## Limitations

- **No automatic orchestration** — you manually open terminals and start each Claude Code instance
- **File-based coordination without locking** — works because agents are slow (minutes between writes) and each only modifies its own task status fields
- **Workers must not touch files outside their task's `files` array** — enforced by convention
- **One swarm at a time** — single tasks.json file
- **No automatic rebase** — workers must manually rebase when main moves forward
