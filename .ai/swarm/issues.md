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

### worker-3 — task-005
**Issue:** Task description says to add `processRetryQueue` on a 30-second `setInterval` in `index.ts`, but `index.ts` is not in the task's `files` array (it belongs to task-001/worker-1).
**Impact:** The retry processor is implemented as exported `startRetryProcessor(prisma)` / `stopRetryProcessor()` functions but not wired into the server startup. Someone needs to call `startRetryProcessor(prisma)` in `index.ts`.
**Suggestion:** Either add `index.ts` to this task's files list, or create a follow-up task for the integration. When a task involves background processors, ensure the entry point file is in the files array.

### Reviewer — task-001 (Wave 10)
**Issue:** Worker defined `depthLimitRule` in schema.ts but forgot to wire it into createYoga() in app.ts. Required sending back for fix.
**Impact:** One review rejection cycle, ~2 min delay.
**Suggestion:** When a task creates a utility/plugin, the acceptance criteria should explicitly verify the integration point (e.g., "verify the rule is referenced in createYoga config in app.ts").

### Reviewer — task-001/task-002 (Wave 10)
**Issue:** Worker-1 and worker-3 both needed to modify sseManager.ts. Worker-3 (task-005) added `closeAllConnections()`, worker-1 (task-002) added the same method plus per-user connection limits. Caused merge conflict when merging worker-1 after worker-3.
**Impact:** One merge rejection, worker had to rebase. ~2 min delay.
**Suggestion:** When two tasks touch the same file across different workers, flag it during planning. Either assign both to the same worker or add explicit dependency ordering.

### Reviewer — task-005 (Wave 10, files)
**Issue:** sseManager.ts not listed in task-005's files array but the task description explicitly required adding closeAllConnections() there.
**Impact:** None — change was appropriate.
**Suggestion:** Always include all files that need modification in the files array, even utility files that need minor additions.

### Reviewer — task-006 (Wave 10, files)
**Issue:** Worker modified auth.prisma, org.prisma (for relations), and resolvers/index.ts — none in the files array.
**Impact:** None — changes were necessary for Prisma relations and resolver registration.
**Suggestion:** Standard pattern: when adding a new Prisma model with relations, include all related schema files and the resolver index in the files array.

### Reviewer — Positive (Wave 10)
**Observation:** Worker-2 delivered both a11y tasks cleanly. The sprint picker implementation in BacklogView was well-designed with proper aria-live announcements and keyboard access.
**Why it worked:** Clean component boundaries — TaskRow is self-contained, making it easy to add the sprint picker without touching other components.

### Reviewer — Positive (Wave 10)
**Observation:** Worker-3's Slack user mapping was a clean vertical slice — Prisma model, migration, GraphQL CRUD, slash command integration, and settings UI all in one task.
**Why it worked:** Task was properly scoped as a full feature, not split into layers. The upsert pattern for mapping was a good choice for idempotency.
