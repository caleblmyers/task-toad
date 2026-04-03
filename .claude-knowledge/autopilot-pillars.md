# Autopilot Pipeline — Three Pillars Implementation Status

The autopilot pipeline is the product. PM features are the dashboard. All three pillars are implemented and deployed.

---

## Pillar 1: Decomposition Engine ✅

**Goal:** Natural language goal → epics → tasks → subtasks with dependency graph.

### Implemented
- `generateHierarchicalPlan` — multi-level planning (epics → tasks → subtasks) with dependency inference
- `generateTaskPlan` — flat task planning with dependency inference (Wave 87)
- `expandTask` — breaks a single task into subtasks
- `TaskDependency` model with typed links (blocks, informs) and `reason` field
- Cycle detection via BFS on dependency graph
- `generateTaskInstructions` — generates detailed implementation instructions
- **Decision points** — `taskKind` (implementation/decision) with selectable options and AI recommendations (Wave 80)
- **Planning quality feedback loop** — execution history (last 10 completed/failed tasks) fed into plan prompt (Wave 80)
- **Scope estimation** — calibration guidelines for AI agent execution time (Wave 80)
- **Iterative refinement** — `refineHierarchicalPlan` mutation for re-planning selected tasks (Wave 84)
- **Refinement UX** — epic-level selection, diff view with accept/discard (Waves 86, 89)
- **AI feature registry** — `callAIFeature<T>()` pattern consolidating wrapper functions (Wave 89)

### Remaining
- [ ] Multi-project decomposition — goals spanning multiple repos/projects (Future)
- [ ] Hierarchical plan streaming — stream partial results instead of waiting for full response

### Key Files
- `apps/api/src/ai/aiService.ts` — AI feature registry + wrapper functions
- `apps/api/src/ai/promptBuilders/hierarchicalPlan.ts` — hierarchical plan prompt with feedback loop, decision points, estimation
- `apps/api/src/ai/promptBuilders/planning.ts` — flat plan prompt with dependency inference
- `apps/api/src/graphql/resolvers/ai/generation.ts` — plan generation, commit, and refinement resolvers
- `apps/api/src/ai/aiTypes.ts` — schemas for plan responses (HierarchicalPlanSchema, ChildTaskPlanSchema)
- `apps/web/src/components/HierarchicalPlanEditor.tsx` — plan editor with decision tasks, refinement, dependency display
- `apps/web/src/components/HierarchicalPlanDialog.tsx` — plan dialog with refinement wiring

---

## Pillar 2: Context Threading ✅

**Goal:** Each task inherits relevant context from completed upstream work.

### Implemented
- Branch-based code generation — each step commits to a feature branch (Wave 64)
- Execution result forwarding — previousStepContext passes summaries between steps (Wave 67)
- Cross-task context summaries — completionSummary consumed by downstream tasks (Wave 67)
- Failure context propagation — failureContext passed to retried/replanned actions (Wave 67)
- Repo file contents in code generation context — `resolveCodeGenContext()` fetches relevant files (Wave 71)
- Schema-first constraint — detects Prisma schema, adds "use these exact models" instruction (Wave 71)
- Dependency-aware execution ordering — orchestrator respects blocking deps, emits task.blocked events (Wave 79)
- Knowledge base — project-level + org-level KB entries, AI-based retrieval for task context
- Insight generation — async event-driven via `insightListener.ts` with KB retrieval (Waves 88-89)

### Key Files
- `apps/api/src/infrastructure/jobs/actionExecutor.ts` — action execution + context threading
- `apps/api/src/infrastructure/listeners/insightListener.ts` — async insight generation
- `apps/api/src/ai/knowledgeRetrieval.ts` — KB retrieval (project + org level)
- `apps/api/src/actions/executors/generateCode.ts` — code generation with repo context
- `apps/api/src/github/githubCommitService.ts` — commit/branch operations

---

## Pillar 3: Orchestration Loop ✅

**Goal:** Monitor execution, handle failures, re-plan when things change. The autopilot that keeps running.

### Implemented
- Branch-based execution — feature branches, sequential commits, PR creation (Wave 64)
- **Parallel execution streams** — plan-aware concurrency: free=1, paid=3 (Wave 88)
- **Auto-replan on failure** — orchestrator auto-replans up to 2 times with failure context (Wave 81)
- **Cross-task orchestration** — sessions execute multiple tasks in dependency order (Wave 68)
- **Quick Start** — `autoStartProject` mutation for one-click autopilot (Wave 82)
- **Health monitoring** — 15-min cron detects stuck plans + stale PRs, creates notifications + SSE alerts (Waves 82, 86, 88)
- **Merge orchestration** — CI webhooks drive auto-merge, external PR merges trigger downstream tasks (Waves 83, 87)
- **CI failure recovery** — webhook-driven fix_ci with retry limit (Waves 84, 85)
- **Bidirectional GitHub sync** — check_suite webhooks emit CI events, pr_merged triggers orchestrator (Wave 83)
- **Progress dashboard** — project-level pipeline status with expandable active plans (Waves 83, 85)
- Budget-aware execution, cancellation via AbortController, approval gates
- **Premium gating** — parallel execution gated behind paid plan (Wave 87)
- **Replan service** — shared replanService.ts callable from resolver + orchestrator (Wave 81)

### Remaining
- [ ] Agent abstraction — pluggable AI backends (Phase 4)

### Key Files
- `apps/api/src/infrastructure/listeners/orchestratorListener.ts` — session orchestration, dependency scheduling, CI/merge events, parallel execution
- `apps/api/src/infrastructure/jobs/actionExecutor.ts` — action plan execution
- `apps/api/src/infrastructure/jobs/healthMonitor.ts` — stuck plan + stale PR detection
- `apps/api/src/actions/replanService.ts` — auto-replan logic
- `apps/api/src/actions/` — executor registry and per-type executors
- `apps/api/src/infrastructure/eventbus/` — typed domain events (task, sprint, CI, session, health)
- `apps/web/src/components/ExecutionDashboard.tsx` — session management, Quick Start, pipeline overview

---

## Implementation Phases — Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ DONE | Foundation fixes (ID remapping, structured output, bot attribution, OAuth) |
| Phase 1 | ✅ DONE | Branch-based pipeline (generate → PR → review → merge) |
| Phase 1.5 | ✅ DONE | Onboarding redesign (AI scaffold, repo bootstrap with intent, organic KB, no interview) |
| Phase 2 | ✅ DONE | Context threading (result forwarding, cross-task summaries, dependency ordering, org KB) |
| Phase 3 | ✅ DONE | Orchestration (sessions, re-planning, parallel execution, health monitoring, merge orchestration) |
| Phase 4 | PLANNED | Agent abstraction (pluggable AI backends) |

---

## What's NOT Priority

Standard PM features. The dashboard is good enough. Don't invest in:
- Advanced automation, scheduled reports
- SSO, audit logs (enterprise — build when there are enterprise customers)
- Refactoring for its own sake (fold into pipeline work)
- Any feature that doesn't directly improve decomposition, context threading, or orchestration
