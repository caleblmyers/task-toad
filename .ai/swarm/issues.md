# Swarm Process Issues Log

Workers and reviewers log issues with the swarm workflow here. The user reviews these after each wave to improve future planning, task descriptions, and process.

Format:
```
### <role> — <task-id>
**Issue:** what went wrong
**Impact:** what happened as a result
**Suggestion:** how to fix for next time
```

---


### Reviewer — task-005
**Issue:** Worker-3 had task-004 and task-005 on the same branch. After task-004 was merged separately, task-005 had a merge conflict in ProjectDetail.tsx. Also missing Prisma migration for AIPromptLog (same issue as task-003).
**Impact:** Rejected, sent back for rebase + migration generation.
**Suggestion:** When a worker has multiple tasks on the same branch, consider merging them together OR have the worker rebase after the first task is merged. Also: ALL tasks that add Prisma models must include migration files — add this as a standard note in task descriptions.

### Reviewer — Positive
**Observation:** Worker-1 delivered both task-001 and task-002 cleanly on one branch, touching 13 files with zero type errors and no lint regressions.
**Why it worked:** The two tasks had no file overlap with other workers, and the worker ran full validation before marking complete.
