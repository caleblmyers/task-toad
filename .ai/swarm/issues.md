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

### Reviewer — task-003 (Wave 11)
**Issue:** Worker-2 submitted task-003 twice with vitest type error — `Cannot find module 'vitest'` in resolverHelpers.test.ts. The `vitest` package was added as devDependency but tsc can't resolve the types without either a triple-slash reference or tsconfig types configuration.
**Impact:** Two review rejections, blocking both task-003 and task-004 (which share the same branch).
**Suggestion:** Task descriptions involving new test frameworks should include: "Ensure `pnpm typecheck` passes — you may need to add `/// <reference types="vitest" />` to test files or add `"types": ["vitest/globals"]` to tsconfig compilerOptions."

### Reviewer — task-001 (Wave 11)
**Issue:** Worker-1 submitted task-001 twice with pino-http type error — `Cannot find module 'pino-http'` in app.ts. The package was installed but TypeScript couldn't find type declarations.
**Impact:** Two review rejections so far.
**Suggestion:** When a task adds a new npm package, explicitly remind workers to verify `pnpm typecheck` passes, and note that some packages need `@types/*` or a custom `.d.ts` declaration.

### worker-3 — task-006
**Issue:** Task files array did not include `apps/api/prisma/schema/auth.prisma`, but adding a `TaskAssignee` model with a relation to `User` requires adding the reverse relation (`taskAssignments TaskAssignee[] @relation("TaskAssignees")`) on the `User` model in auth.prisma.
**Impact:** Minimal — had to modify an unlisted file. Change was a single line addition.
**Suggestion:** Standard pattern noted in previous waves: when adding a new Prisma model with relations to existing models, always include the related schema files (auth.prisma, org.prisma, etc.) in the files array.

### Reviewer — task-001/task-002 (Wave 11)
**Issue:** merge-worker.sh --validate runs typecheck before pnpm install, so new devDependencies (vitest, prom-client) aren't installed and types can't be found. Had to manually squash merge, run pnpm install, then validate.
**Impact:** Multiple false rejections for task-001 (pino-http types) and task-003 (vitest types). Worker-1 solved it by rewriting to avoid pino-http; reviewer had to manually handle the merge flow for tasks with new dependencies.
**Suggestion:** merge-worker.sh should run `pnpm install` after staging the squash merge but before running typecheck/lint/build. This is critical when tasks add new npm packages.

### Reviewer — Positive (Wave 11)
**Observation:** Worker-3 delivered both task-005 (custom field DataLoader + filters) and task-006 (multiple assignees) cleanly with no rejections. Both were full vertical slices touching API + frontend.
**Why it worked:** Clean, well-scoped tasks with no file overlap with other workers. Worker followed existing DataLoader and resolver patterns.

### Reviewer — Positive (Wave 11)
**Observation:** Worker-1 pivoted from pino-http (type issues) to a custom Express middleware that handles both logging and Prometheus metrics in one pass. More efficient and avoids the external dependency type problem.
**Why it worked:** Worker autonomously chose a better approach when the prescribed one hit an obstacle.

### worker-3 — task-005
**Issue:** Task required modifying CLAUDE.md, but the worker role section is appended to CLAUDE.md in each worktree. The worker rules say "Do not modify CLAUDE.md" to avoid committing the worker role block, but this task specifically lists CLAUDE.md as a file to modify for documentation updates.
**Impact:** First commit included the entire worker role section. Reviewer caught it and sent the task back. Required an extra fixup commit and restoring the worker role in the working copy.
**Suggestion:** When a task needs to modify CLAUDE.md, the task description should explicitly warn: "Only modify the main content above the `---` separator. Do NOT commit the worker role section below. Stage the clean version, commit, then restore the worker role in your working copy."

### Reviewer — task-005 (Wave 12)
**Issue:** Worker-3 committed their "Role: Swarm Worker (worker-3)" section appended to CLAUDE.md. This is the worktree-specific role injection that should never be committed to main.
**Impact:** Required sending the task back for a fixup commit. One extra review cycle.
**Suggestion:** The swarm setup should .gitignore or auto-strip the role section before commit, OR task descriptions that modify CLAUDE.md should include explicit acceptance criterion: "Verify the worker role section is NOT included in the commit."

### Reviewer — Positive (Wave 12)
**Observation:** Worker-1 delivered both memoization (task-001) and lazy-loading/portfolio optimization (task-002) cleanly with zero rejections. Both commits were well-scoped with proper React patterns.
**Why it worked:** Tasks had clear file boundaries, no overlap with other workers, and the acceptance criteria were concrete and verifiable.

### Reviewer — Positive (Wave 12)
**Observation:** Worker-2 delivered task-003 (task templates, full vertical slice) cleanly — Prisma model, migration, GraphQL CRUD, and complete UI in one commit.
**Why it worked:** Proper task sizing as a full vertical slice. No layer-by-layer splitting.

### Reviewer — task-003 (Wave 12, files)
**Issue:** Task files array listed `auth.prisma` for the Org relation, but the Org model is actually in `org.prisma`. Worker correctly modified `org.prisma` instead.
**Impact:** None — worker made the right call.
**Suggestion:** Verify file locations during task planning, especially for Prisma schema files where model-to-file mapping isn't always intuitive.

### Reviewer — Positive (Wave 13)
**Observation:** All 6 tasks passed review on first attempt — zero rejections this wave.
**Why it worked:** Tasks had clear acceptance criteria, reasonable scope (30-60 min each), and non-overlapping file arrays. Workers adapted to actual backend types rather than task description suggestions (e.g. task-005 CodeReview type matched real GraphQL schema).

### Reviewer — Positive
**Observation:** Worker-2 adapted task-004 Zod validation cleanly — used safeParse with warning logs + fallbacks rather than throwing, consistent pattern across all 7 call sites.
**Why it worked:** Task description explicitly specified the fallback strategy, reducing ambiguity.

### Reviewer — Observation
**Observation:** Worker-3 completed both tasks (005 + 006) on a single branch, requiring manual commit splitting during merge. This works but adds reviewer friction.
**Suggestion:** Consider whether workers should create separate branches per task, or accept that squash merges from multi-task branches require manual splitting.

### Reviewer — task-001 (Wave 14)
**Issue:** merge-worker.sh still doesn't run `pnpm install` after merging, causing `Cannot find module '@sentry/node'` typecheck failures. Had to manually merge, install, and validate.
**Impact:** False validation failure on first attempt. Required manual workaround for all tasks with new npm deps.
**Suggestion:** This was reported in Wave 11 — merge-worker.sh needs `pnpm install` added after staging the merge and before validation. Should be fixed before next wave.

### Reviewer — task-005 (Wave 14)
**Issue:** `lazyWithRetry` has a bug in the retry path — recursively calls itself (returning `LazyExoticComponent`) instead of retrying `importFn()` directly. The `as never` cast hides the type mismatch. Retry would fail at runtime.
**Impact:** Minor — only affects chunk load failures on bad networks. Happy path (lazy loading) works fine.
**Suggestion:** Add as follow-up: fix `lazyWithRetry` to retry `importFn()` directly instead of recursively creating new lazy components.

### Reviewer — task-005 (Wave 14, minor)
**Issue:** Task description mentions lazy-loading `BatchCodeGenModal` but worker didn't include it. Minor gap.
**Impact:** None — BatchCodeGenModal is still eagerly imported.
**Suggestion:** Minor follow-up item.

### Reviewer — Positive (Wave 14)
**Observation:** All 6 tasks merged on first review pass — zero rejections. Workers ran full validation before marking complete.
**Why it worked:** Clean task scoping, non-overlapping files between workers (except worker-3's own tasks which shared ProjectDetail.tsx). Acceptance criteria were specific and verifiable.

### Reviewer — Positive (Wave 14)
**Observation:** Worker-2's sprint picker accessibility work (task-004) was exemplary — full ARIA listbox pattern with proper focus management, keyboard navigation, and click-outside handling.
**Why it worked:** Task description was highly detailed with specific ARIA attributes and interaction patterns spelled out.
