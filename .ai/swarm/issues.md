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

### Reviewer — task-002
**Issue:** Worker submitted code without running `prisma generate` after adding new schema models. The migration SQL file was added but the generated Prisma client types were stale, causing 17 typecheck errors. Required manual `prisma generate` on main after merge.
**Impact:** Rejected once, delayed merge by one review cycle. Had to manually run prisma generate on main after squash merge.
**Suggestion:** Task descriptions that include Prisma schema changes should explicitly state: "Run `npx prisma generate` AND verify `pnpm typecheck` passes before marking completed." The merge-worker.sh script should also run `prisma generate` when it detects schema changes in the diff.

### Reviewer — task-002 (minor)
**Issue:** The "JSON string columns → proper types" acceptance criterion (parseColumns/parseSuggestedTools helpers) was not implemented. Worker completed custom fields and saved filters but skipped the JSON cleanup.
**Impact:** Minor — no functionality affected, just missed code cleanup.
**Suggestion:** If a task has lower-priority sub-items, consider splitting them or explicitly marking them as optional.

### Reviewer — task-002 (files)
**Issue:** Worker modified 3 files not in the task's `files` array: auth.prisma, org.prisma, resolvers/index.ts. These were necessary for Prisma relations and resolver registration.
**Impact:** None — changes were appropriate and necessary.
**Suggestion:** When task files include Prisma schema additions with relations, include the related model files (auth.prisma, org.prisma etc.) in the files array.
