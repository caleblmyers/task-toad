---
name: task-assign
description: Dynamically add new tasks to a running worker's queue without affecting other workers. Use when a worker finishes early and the user says "assign more tasks to worker-N", "worker N is done add more", or "add tasks for worker-2".
disable-model-invocation: false
user-invocable: true
---

# Assign Tasks to Running Worker

You are adding tasks to a worker that has finished its current tasks while other workers are still active.

## Arguments

The user should specify which worker (e.g., `/task-assign worker-2` or just mention which worker is free).

## Steps

### 1. Check Current State

Read `.ai/swarm/tasks.json` to understand:
- Which worker is free (all their tasks are `merged`)
- Which workers are still active (`in_progress` or `completed` tasks)
- What files are currently being touched by active workers

```bash
cat .ai/swarm/tasks.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.tasks.forEach(t => console.log(t.id, t.status.padEnd(12), t.assignee.padEnd(10), t.title.slice(0,65)))"
```

### 2. Identify File Conflicts

Build a list of ALL files that active workers (non-merged tasks) are touching:
- Read each active task's `files` array
- These files are OFF LIMITS for the new tasks

Report the conflict map to help with planning:
```
Active worker-1 files: [list]
Active worker-3 files: [list]
Safe for worker-2: anything not in the above
```

### 3. Select Work

- Read `.claude-knowledge/todos.md` for available work
- Pick items from sets whose files DON'T overlap with active workers
- If the user specified what work to assign, use that (but verify no file conflicts)
- If not specified, pick the highest-value available items

### 4. Research and Plan Tasks

- Read the relevant source files to understand current state
- Follow Task Sizing rules: each task = 30-60 min, full vertical slices
- 2-4 tasks per worker

### 5. Add Tasks to Queue

Use node to append tasks to the existing tasks.json WITHOUT modifying existing tasks:

```bash
node -e "
const fs = require('fs');
const f = '.ai/swarm/tasks.json';
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
// Add new group if not present
if (!d.config.groups.includes('NEW_GROUP')) d.config.groups.push('NEW_GROUP');
// Append new tasks
d.tasks.push({ id: 'task-NNN', ... });
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
"
```

Use sequential task IDs that continue from the highest existing ID.

**CRITICAL:** Do NOT modify any existing task entries. Only append new tasks to the array.

### 6. Confirm

Report what was added:
- Task IDs, titles, and estimated time
- Which files they touch (confirming no conflicts)
- The worker will pick them up automatically on its next loop
