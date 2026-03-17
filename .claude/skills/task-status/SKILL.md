---
name: task-status
description: Show the current status of all swarm tasks, workers, and any blockers or issues. Use when the user asks "swarm status", "how are workers doing", "check swarm", or "task status".
disable-model-invocation: false
user-invocable: true
---

# Swarm Status Check

Show a quick, comprehensive view of the current swarm state.

## Gather Data

1. **Task statuses** from `.ai/swarm/tasks.json`:
```bash
cat .ai/swarm/tasks.json | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('Swarm:', d.swarmId, '| Groups:', d.config.groups.join(', '));
console.log('');
const byWorker = {};
d.tasks.forEach(t => {
  if (!byWorker[t.assignee]) byWorker[t.assignee] = [];
  byWorker[t.assignee].push(t);
});
for (const [worker, tasks] of Object.entries(byWorker)) {
  console.log(worker + ':');
  tasks.forEach(t => {
    const time = t.status === 'merged' ? '(' + Math.round((new Date(t.reviewedAt) - new Date(t.startedAt))/60000) + 'min)' : t.startedAt ? '(started ' + Math.round((Date.now() - new Date(t.startedAt))/60000) + 'min ago)' : '';
    const notes = t.reviewNotes ? ' ⚠️ REVIEW NOTES' : '';
    console.log('  ' + t.id + ' [' + t.status + '] ' + t.title.slice(0,55) + ' ' + time + notes);
  });
  console.log('');
});
const counts = { pending: 0, in_progress: 0, completed: 0, merged: 0, blocked: 0 };
d.tasks.forEach(t => counts[t.status] = (counts[t.status]||0) + 1);
console.log('Summary: ' + Object.entries(counts).filter(([_,v])=>v>0).map(([k,v])=>v+' '+k).join(', '));
"
```

2. **Worktree status:**
```bash
git worktree list
```

3. **Process issues** (if any logged):
```bash
cat .ai/swarm/issues.md 2>/dev/null | tail -30
```

4. **Recent commits on main** (from reviewer merges):
```bash
git log --oneline -5
```

## Format Output

Present as a clear, scannable report:

```
## Swarm Status: [swarm-id]
Groups: W3, W4, W5

### worker-1: [STATUS]
- task-001 [merged] Title (Xmin)
- task-002 [in_progress] Title (started Ymin ago)

### worker-2: [STATUS]
- task-003 [merged] Title (Xmin)
- task-004 [completed] Title — awaiting review

### worker-3: [STATUS]
- task-005 [in_progress] Title (started Ymin ago) ⚠️ REVIEW NOTES

### Summary
- X merged, Y in progress, Z pending
- [Any blocked tasks or review rejections to flag]
- [Any issues from issues.md]
```

Worker STATUS is one of:
- **Done** — all tasks merged
- **Working** — has in_progress tasks
- **Awaiting review** — has completed tasks pending reviewer
- **Blocked** — has blocked tasks or review rejections
- **Idle** — all tasks merged, could take new work (suggest `/task-assign`)
