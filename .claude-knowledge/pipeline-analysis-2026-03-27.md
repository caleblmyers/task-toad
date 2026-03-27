# Pipeline Analysis: US Lakes Information Portal (2026-03-27)

First real end-to-end test of the autopilot pipeline on a user project. 4 tasks in Sprint 1 completed through the full `generate_code → create_pr → review_pr → fix_review → merge_pr` pipeline.

## Execution Summary

| Task | Review | Fixes | Deferred Tasks | Merged |
|------|--------|-------|----------------|--------|
| Initialize project structure | Changes requested | 6 | 5 | Yes |
| Set up API framework | Changes requested | 6 | 7 | Yes |
| Configure database schema | Changes requested | 2 | 4 | Yes |
| Configure deployment pipeline | Changes requested | 5 | 5 | Yes |

**Totals:** 19 fixes applied, 21 follow-up tasks auto-created, 4 PRs merged (2 commits each: code + fix-up).

## What Worked

- **Pipeline mechanics:** Every step executed correctly. SSE real-time updates, task status transitions (`todo → in_progress → in_review → done`), board column sync, PR create/review/fix/merge — all without manual intervention.
- **Review→fix loop:** Zero reviews approved on first pass. The skeptical reviewer caught SQL injection, missing validation, connection pool issues, security vulnerabilities. fix_review applied 19 concrete fixes with full source code context. Massive improvement over the pre-fix state (0 fixes applied when fix_review couldn't see comments).
- **Individual task quality:** Each PR in isolation shows good patterns — Zod validation, auth middleware, parameterized queries, pagination caps, multi-stage Docker builds, health checks.

## What Didn't Work: Cross-Task Coherence

**The 4 PRs do not compose into a working application.** Each task generated code in isolation.

### Specific conflicts found:
1. **Three conflicting data models** — Prisma schema (Task 1) defines `Lake`, `WaterQuality`, `Wildlife`. SQL migration (Task 3) creates a different PostGIS schema with `habitats`, `wildlife_species`, `water_quality_metrics`. API routes (Task 2) reference `wildlifeCameras`, `habitatTypes`. None align.
2. **Broken imports** — Routes import `@/lib/error-handler` (doesn't exist). `queries.ts` references Prisma models not in schema. Seed script uses non-existent model names.
3. **Dead/duplicate code** — `lib/database.ts` with stub functions (never used). Two PostCSS configs. Duplicate auth middleware.
4. **Unused dependencies** — Leaflet, Recharts, next-auth in package.json with no usage.

**Root cause:** `generateCode` receives a file tree listing (paths only) and brief completion summaries from upstream tasks. It does NOT receive actual file contents from the repo. So Task 2 guesses at Prisma model names instead of reading the schema from Task 1.

## Recommendations

### R1: Fetch repo file contents before code generation (highest impact)
The `generateCode` executor should read key files from the GitHub repo — Prisma schema, package.json, existing route files, type definitions — and include their contents in the AI prompt. The file tree listing alone is insufficient for coherent multi-task code generation.

### R2: Schema-first constraint
When a Prisma schema (or equivalent) exists in the repo, explicitly tell the AI: "These are the data models. Use exactly these names and relations. Do not invent new ones."

### R3: Cross-task diffs as context
Completion summaries are brief text. For code generation, include actual file paths, key type definitions, and API contracts from previous PRs — not just a sentence summary.

### R4: Post-merge build verification
After `merge_pr`, verify the repo builds (`npm install && npm run build`). This could be `monitor_ci` if GitHub Actions are configured, or a new lightweight verification step.

### R5: Sprint close reconciliation
When closing a sprint, run a consistency check across all merged PRs — do imports resolve, do types match, does the app build? Generate a reconciliation PR if needed. This fits naturally in the existing `closeSprint` flow.
