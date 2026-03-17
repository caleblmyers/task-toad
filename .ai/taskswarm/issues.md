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

### Reviewer — task-005 (Wave 15)
**Issue:** Worker-3 did not rebase after first rejection for merge conflict in TableView.tsx. Same commit hash was resubmitted, causing the same conflict. Required a second rejection with more explicit instructions.
**Impact:** Two review rejections, delayed merge by ~3 minutes total.
**Suggestion:** Review notes for merge conflicts should include the explicit command: "Run `git rebase main` to resolve conflicts." Workers should verify merge-ability before re-marking as completed.

### Reviewer — Positive (Wave 15)
**Observation:** Worker-1 delivered 51 unit tests and integration tests with CI pipeline changes — all passed on first review. Worker-2 delivered 4 frontend fixes (lazyWithRetry, lazy modals, cache limit, cost rule) plus virtualization — all clean.
**Why it worked:** No file overlap between workers 1 and 2. Tasks were well-scoped with concrete acceptance criteria. merge-worker.sh now handles pnpm install automatically.

### Reviewer — Positive (Wave 15)
**Observation:** merge-worker.sh pnpm install fix (from Wave 14) worked flawlessly this wave — react-window dependency was auto-installed during validation. Zero manual workarounds needed.
**Why it worked:** The script detects package.json changes and runs pnpm install before typecheck/lint.

### Reviewer — task-004 (Wave 16)
**Issue:** Worker-2's branch still contained task-003 commits that had been separately merged to main. Caused merge conflicts in ai.ts and task.ts typedefs.
**Impact:** One review rejection, worker had to rebase. ~2 min delay.
**Suggestion:** Workers should rebase onto main after their first task is merged (before marking second task complete), especially when both tasks touched the same branch.

### Reviewer — task-002 (Wave 16, security)
**Issue:** Upload filename uses `${Date.now()}-${file.originalname}` without sanitizing `originalname`. If a malicious client sends `../../etc/passwd` as the filename, `path.join(uploadDir, filename)` could resolve outside the upload directory.
**Impact:** No immediate issue (auth required, local dev only), but a security concern for production.
**Suggestion:** Use `path.basename(file.originalname)` to strip directory components. Added as follow-up todo.

### Reviewer — task-002 (Wave 16, minor)
**Issue:** upload.ts creates its own `new PrismaClient()` instead of using the app-level shared instance. This wastes a DB connection pool slot.
**Impact:** Minor — functional but wasteful. Could cause connection exhaustion under load.
**Suggestion:** Refactor to accept prisma via middleware or factory function. Added as follow-up todo.

### Reviewer — Positive (Wave 16)
**Observation:** 5 of 6 tasks passed review on first attempt. Worker-1 delivered both recurring tasks and file attachments (two complex vertical slices) cleanly. Worker-3 delivered all test tasks with proper mocking patterns.
**Why it worked:** Tasks were well-scoped 30-60 min vertical slices. Acceptance criteria were specific. merge-worker.sh auto-detected Prisma changes and ran generate.

### Reviewer — Positive (Wave 16)
**Observation:** merge-worker.sh handled pnpm install (multer) and prisma generate automatically this wave. Zero manual workarounds needed for either new dependencies or schema changes.
**Why it worked:** Script improvements from Wave 14/15 working as intended.

### Reviewer — task-006 (Wave 19)
**Issue:** Worker-3's shared-types package had `"types": "dist/index.d.ts"` in package.json, requiring the package to be built before web typecheck could resolve imports. Since `dist/` doesn't exist in a fresh checkout, typecheck failed with "Cannot find module '@tasktoad/shared-types'" plus 34 cascading `any` type errors.
**Impact:** One review rejection. Worker fixed by pointing `types` to `src/index.ts` instead.
**Suggestion:** Task descriptions creating new workspace packages should note: "Point `types` field to source (`src/index.ts`) not dist, so typecheck works without a build step."

### Reviewer — Positive (Wave 19)
**Observation:** 5 of 6 tasks passed review on first attempt. Workers 1 and 2 delivered clean results with no rejections. merge-worker.sh handled pnpm install for the new workspace package automatically.
**Why it worked:** Non-overlapping file arrays, clear acceptance criteria, and improved merge tooling.

### Reviewer — Positive (Wave 19)
**Observation:** Task-005 swarm workflow improvements (auto-prisma, validate-tasks.sh, role stripping) directly addressed issues logged in previous waves. Good example of using issues.md feedback to improve tooling.
**Why it worked:** The task was directly derived from reviewer pain points documented in earlier waves.

### Reviewer — Positive (Wave 20)
**Observation:** All 6 tasks merged successfully. Workers 1 and 3 passed first review. Worker 2 required one rejection for CLAUDE.md worker role leak (recurring issue) but the code itself was clean.
**Why it worked:** Tasks were well-scoped with clear acceptance criteria. No file overlap between workers. merge-worker.sh auto-handled pnpm install for new dependencies.

### Reviewer — Positive (Wave 20)
**Observation:** Worker-2's S3 migration was a clean implementation — lazy S3Client init, proper fallback to local disk, presigned URL redirects, health check integration. No security shortcuts.
**Why it worked:** Task description was extremely detailed with step-by-step implementation plan and specific file modifications.

### Reviewer — task-006 (Wave 20)
**Issue:** Worker-3 needed two review passes — first for lockfile conflict (hadn't rebased after task-005 merge), second after rebase. Not the worker's fault — they completed task-006 before task-005 was merged to main.
**Impact:** One extra review cycle, ~2 min delay.
**Suggestion:** When a worker has multiple tasks on the same branch, the reviewer should merge them together if possible, or ensure the worker rebases between tasks.

### worker-2 — task-002
**Issue:** File list was incomplete for the dark mode contrast audit. `dark:text-slate-400` on `dark:bg-slate-900` violations also exist in `BacklogView.tsx`, `KanbanBoard.tsx`, `ProjectToolbar.tsx`, `ActivityFeed.tsx`, and ~20 other components, but these were not in the task's `files` array.
**Impact:** Only 4 of ~29 affected components were fixed. The remaining components still fail WCAG AA contrast in dark mode.
**Suggestion:** For broad audit tasks like contrast fixes, either include all affected files in the `files` array, or allow workers to touch any file matching a specific pattern (e.g., "any component with `dark:text-slate-400`"). Alternatively, split into a dedicated follow-up task for the remaining files.

### Reviewer — Positive (Wave 21)
**Observation:** All 3 tasks passed review on first attempt — zero rejections. Clean diffs, correct file scoping, no secrets or debug code.
**Why it worked:** Tasks were well-scoped bundles of related follow-ups from Wave 20. Workers ran full validation before marking complete. No file overlap between workers.

### Reviewer — task-002 (Wave 21, files)
**Issue:** Task files array listed `apps/web/src/components/ProjectDetail.tsx` but the actual path is `apps/web/src/pages/ProjectDetail.tsx`. Worker found the correct file.
**Impact:** None — worker adapted correctly.
**Suggestion:** Verify file paths during task planning, especially for components vs pages directories.

### Reviewer — task-003 (Wave 21, partial)
**Issue:** Task description asked for shared-types re-exports in "2-3 more API resolver files (e.g., resolvers/sprint.ts, resolvers/comment.ts)" but worker only added exports to sprint.ts, not comment.ts.
**Impact:** Minor — sprint.ts covers 3 types (Sprint, CloseSprintResult, SprintPlanItem). Comment resolver has no shared types to export.
**Suggestion:** When "2-3" is a suggestion, mark it as optional or specify exactly which resolvers and what types to export.

### worker-3 — task-006
**Issue:** Task listed `comment.ts` and `report.ts` in the files array, but these resolver files don't exist. Comments are handled in `task.ts` resolver and reports don't have a dedicated resolver file.
**Impact:** Could only add re-exports to `notification.ts`. Two of the three target files were invalid.
**Suggestion:** Verify file paths exist before assigning them in task planning. Use `ls` or `glob` to confirm resolver file structure.

### Reviewer — Positive (Wave 24)
**Observation:** All 6 tasks merged with zero rejections. Every worker ran full validation before marking complete. Lint went from 9 warnings to 0.
**Why it worked:** Tasks were well-scoped (CSS-only contrast fixes, specific lint warnings, component migrations). No file overlap between workers. Acceptance criteria were concrete and verifiable.

### Reviewer — Positive (Wave 24)
**Observation:** Worker-1's lint fixes were technically excellent — used cancellation flags in useEffect, proper useCallback/useMemo patterns, and HTML entity escapes. No behavior changes.
**Why it worked:** Task description gave specific fix strategies for each warning, reducing ambiguity.

### Reviewer — task-006 (Wave 24, files)
**Issue:** Task listed `comment.ts` and `report.ts` as files to potentially add shared-types re-exports, but Comment and Report types don't exist in shared-types yet. Worker correctly skipped those and only added the notification re-export.
**Impact:** None — worker made the right call.
**Suggestion:** Before assigning shared-types re-export tasks, verify which types actually exist in the shared-types package.

### Reviewer — Observation (Wave 24)
**Observation:** Worker-1's hover state change in CSVImportModal and SprintTransitionModal (dark:hover:text-slate-300 → dark:hover:text-slate-200) was initially flagged as scope creep but was actually necessary — without it, the hover state would be identical to the new base color, eliminating the hover effect.
**Suggestion:** For contrast fix tasks, note that adjusting hover states may be necessary when changing base colors. Include this in the task description to avoid false review rejections.

### Reviewer — Positive (Wave 25)
**Observation:** All 5 tasks merged with zero rejections. Workers ran full validation before marking complete. Worker-3 completed both tasks (004 + 005) quickly and cleanly.
**Why it worked:** Tasks were well-scoped component-level refactors with clear file boundaries. Badge variant expansion (task-002) landed first, enabling task-003 to build on it. No file overlap between workers.

### Reviewer — task-002 (Wave 25, files)
**Issue:** Task files array listed `components/taskdetail/TaskDetailPanel.tsx` but the actual file is `components/TaskDetailPanel.tsx` (not in `taskdetail/` subdirectory). Worker correctly found and modified the actual file.
**Impact:** None — worker adapted correctly.
**Suggestion:** Verify file paths exist before planning. The `taskdetail/` subdirectory contains sub-components, not the main panel.

### Reviewer — Positive
**Observation:** All 3 tasks merged cleanly despite shared file (ProjectToolbar.tsx touched by worker-1 and worker-2). Git auto-merge handled the non-overlapping changes perfectly.
**Why it worked:** Task descriptions clearly scoped worker-1 to focus trap logic and worker-2 to responsive layout — different concerns in the same file. The changes didn't touch the same lines.

### Reviewer — Positive
**Observation:** Worker-2 completed fastest, letting reviewer merge it first, which meant worker-1's later merge had a clean auto-merge target.
**Why it worked:** Task sizing was appropriate — responsive layout was more mechanical, focus trap extraction was more complex. Natural completion order matched ideal merge order.
