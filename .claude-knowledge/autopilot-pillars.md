# Autopilot Pipeline — Three Pillars Implementation Plan

The autopilot pipeline is the product. PM features are the dashboard. This document tracks the state of each pillar.

---

## Pillar 1: Decomposition Engine

**Goal:** Natural language goal → epics → tasks → subtasks with dependency graph. Most defensible, hardest to replicate.

### What Exists Today
- `generateTaskPlan` — takes a project description, generates a flat list of tasks (titles, descriptions, priorities)
- `expandTask` — breaks a single task into subtasks
- `generateHierarchicalPlan` / `previewHierarchicalPlan` / `commitHierarchicalPlan` — multi-level planning (epics → tasks → subtasks)
- `TaskDependency` model with typed links (blocks, relates_to, duplicates, informs)
- Cycle detection via BFS on dependency graph
- `generateTaskInstructions` — generates detailed implementation instructions for a task

### What Needs to Be Built/Improved
- [ ] **Dependency inference during planning** — the planner generates tasks but doesn't infer dependencies between them. Users add dependencies manually. The decomposition engine should output a dependency graph, not just a flat list.
- [ ] **Planning quality feedback loop** — when tasks fail during execution, feed that information back to improve future decomposition. If the planner consistently under-scopes tasks, learn from it.
- [ ] **Scope estimation** — each decomposed task should have an estimated complexity/effort so the orchestrator can make sequencing decisions.
- [ ] **Iterative refinement** — allow re-planning a subset of tasks when requirements change, without regenerating the entire plan.
- [ ] **Multi-project decomposition** — break down a goal that spans multiple repos/projects.

### Key Files
- `apps/api/src/ai/aiService.ts` — `generateTaskPlan`, `expandTask`, `planTaskActions`
- `apps/api/src/ai/promptBuilders/planning.ts` — prompt construction
- `apps/api/src/graphql/resolvers/taskaction.ts` — plan generation resolver
- `apps/api/src/ai/aiTypes.ts` — schemas for plan responses

---

## Pillar 2: Context Threading

**Goal:** Each task inherits relevant context from completed upstream work. Task #5 succeeds because tasks #1-4 informed it.

### What Exists Today
- `TaskDependency` model with `informs` link type
- `generateTaskInsights` — generates insights for a task based on its description
- Insight propagation logic in `actionExecutor.ts` — when a task completes, insights are propagated to downstream tasks
- Knowledge base (`KnowledgeEntry` model) — stores project-level context
- `knowledgeRetrieval.ts` — AI-based retrieval of relevant KB entries for a given task
- KB auto-population after scaffold (Wave 60)
- Action plan pipeline passes `knowledgeContext` to executors

### What Needs to Be Built/Improved
- [ ] **Branch-based code generation** (documented in todos.md as "Action Pipeline Rewrite") — each step commits to a feature branch so subsequent steps see previous work on GitHub. This is the most critical context threading gap.
- [ ] **Execution result forwarding** — when `generate_code` produces files, the next `generate_code` step should receive a summary of what was generated (not just the repo state, but explicit "here's what the previous step did and why").
- [ ] **Cross-task context summaries** — when a task completes, generate a structured summary (what was built, key decisions, API contracts, gotchas) that downstream tasks can consume. Currently insights are free-text; they should be structured.
- [ ] **Dependency-aware execution ordering** — the orchestrator should execute tasks in topological order based on the dependency graph, not just sequentially within a plan.
- [ ] **Failure context propagation** — when a task fails, the error context should inform the retry/re-plan, not just be logged.

### Key Files
- `apps/api/src/infrastructure/jobs/actionExecutor.ts` — action execution + insight propagation
- `apps/api/src/ai/knowledgeRetrieval.ts` — KB retrieval for task context
- `apps/api/src/actions/executors/generateCode.ts` — code generation (reads repo for context)
- `apps/api/src/github/githubCommitService.ts` — commit/branch operations
- `apps/api/prisma/schema/task.prisma` — TaskDependency model

---

## Pillar 3: Orchestration Loop

**Goal:** Monitor execution, handle failures, re-plan when things change. The autopilot that keeps running.

### What Exists Today
- `actionExecutor.ts` — sequential execution of action plan steps (generate_code → create_pr → review_pr → monitor_ci → fix_ci)
- In-process job queue with retry logic (configurable max retries per action)
- `monitor_ci` executor — polls GitHub Actions for CI status
- `fix_ci` executor — reads CI error logs and generates a fix commit
- SSE events for real-time progress (`task.action_completed`, `task.action_plan_completed`, `task.action_plan_failed`)
- Budget-aware execution (checks AI budget before each step)
- Cancellation support via AbortController
- Approval gates (actions can require user approval before executing)

### What Needs to Be Built/Improved
- [ ] **Branch-based execution** (same as Pillar 2 — prerequisite for real orchestration)
- [ ] **Parallel execution streams** — currently all actions run sequentially. Independent tasks (no dependency) should execute in parallel. Requires moving from a single-plan sequential executor to a DAG-based scheduler.
- [ ] **Re-planning on failure** — when an action fails and can't be retried, the orchestrator should be able to generate a new plan for the remaining work rather than just stopping.
- [ ] **Cross-task orchestration** — execute multiple tasks in a project in dependency order. Currently each task has its own independent action plan. The project-level orchestrator should schedule task execution based on the project's dependency graph.
- [ ] **Health monitoring** — detect stuck tasks, stale branches, conflicting changes. Alert the user when intervention is needed.
- [ ] **Merge orchestration** — after a PR is approved and CI passes, auto-merge. Then trigger downstream tasks.
- [ ] **Progress dashboard improvements** — show project-level pipeline status (not just per-task action plans). "3 of 12 tasks executing, 2 PRs open, 1 blocked on CI."
- [ ] **Agent abstraction** — decouple from direct Claude API calls. Support pluggable agents (Claude Code, Codex, local LLMs) behind a common interface. This is the "abstraction layer on top of AI coding agents" positioning.

### Key Files
- `apps/api/src/infrastructure/jobs/actionExecutor.ts` — the core orchestrator
- `apps/api/src/infrastructure/jobqueue/` — job queue (in-process adapter)
- `apps/api/src/actions/` — executor registry and per-type executors
- `apps/api/src/infrastructure/eventbus/` — typed domain events
- `apps/web/src/components/ActionProgressPanel.tsx` — execution progress UI

---

## Implementation Priority

### Phase 0: Foundation fixes (DONE)

Infrastructure work that persists regardless of pipeline changes:
- [x] Action ID remapping — AI placeholder IDs (`action_0`) mapped to real UUIDs on plan commit
- [x] Structured output via tool_use — code generation returns guaranteed valid JSON
- [x] Scaffold commits via installation token — attributed to TaskToad bot
- [x] Empty repo commit fix — Contents API bootstraps first file
- [x] GitHub OAuth for personal account repo creation
- [x] `executeActionPlan` allows resuming paused plans (approval gate)
- [x] Approve & Continue UI for actions requiring approval
- [x] Switched AI model to Sonnet 4

### Phase 1: Pipeline rewrite — branch-based execution (CURRENT)

**Goal:** One happy path works reliably: describe project → scaffold repo → create task → auto-complete → working PR on GitHub. All code gen commits to a feature branch, steps see each other's work, pipeline ends with a real PR.

See todos.md "Action Pipeline Rewrite" section for the full implementation spec.

**Scope includes:**
1. Feature branch creation when plan starts executing
2. `generate_code` commits to feature branch after generating
3. Subsequent steps read the branch (see previous commits for context)
4. `create_pr` opens PR from existing feature branch (not from scratch)
5. `write_docs` commits to the same branch
6. Planner always includes `create_pr` + `review_pr` for connected repos
7. End-to-end: new project → scaffold → task → auto-complete → PR on GitHub
8. SSE real-time updates during action execution (fix stale frontend closure)
9. Verify full chain works: generate_code → create_pr → review_pr → monitor_ci

**What "done" looks like:** A new user can sign up, create a project, connect GitHub, describe a feature, and get a PR with generated code — without errors, without manual intervention beyond approval gates. Each step's output is visible on GitHub as commits on a feature branch.

### Phase 2: Context threading (the real differentiator)

3. Execution result forwarding between steps (structured summaries, not just raw files)
4. Cross-task context summaries — when a task completes, downstream tasks get structured context
5. Dependency-aware execution ordering across tasks

### Phase 3: Orchestration improvements (makes it an autopilot)

6. Dependency inference during decomposition (planner outputs dependency graph)
7. Cross-task orchestration (project-level DAG scheduler)
8. Re-planning on failure
9. Parallel execution streams

### Phase 4: Competitive moat (later)

10. Agent abstraction (pluggable AI backends — Claude Code, Codex, etc.)
11. Merge orchestration + progress dashboard
12. Multi-project orchestration

### Refactoring

A parallel codebase audit is running (staff-level review of architecture, abstractions, hotspots). Refactoring should be done alongside pipeline work, not as a separate phase. When implementing Phase 0-1, incorporate audit findings for files being touched (e.g., if `actionExecutor.ts` needs decomposition, do it as part of the branch-based execution work).

---

## What's NOT Priority

Standard PM features. The dashboard is good enough. Don't invest in:
- Sprint column reordering, priority color coding, mobile polish
- Advanced automation, scheduled reports
- Pricing/billing (no paying users yet)
- Landing page (product doesn't work end-to-end yet)
- SSO, audit logs (enterprise — build when there are enterprise customers)
- Refactoring for its own sake (fold into pipeline work)
- Any feature that doesn't directly improve decomposition, context threading, or orchestration
