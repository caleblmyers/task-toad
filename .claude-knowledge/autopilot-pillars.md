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
- [ ] **Decision points in task plans** — the planner should distinguish between implementation tasks (clear what to do) and decision tasks (multiple valid approaches). Tasks involving tech/service choices (auth strategy, database, hosting, payment provider) should be generated as generic tasks with options, not opinionated picks. E.g., "Set up authentication" with options (Auth0 / in-house JWT / Clerk) rather than "Set up Auth0 integration." Users resolve decision points before execution starts; AI recommendation is highlighted but not forced.
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
- [x] **Branch-based code generation** — each step commits to a feature branch. DONE (Wave 64).
- [x] **Execution result forwarding** — previousStepContext passes summaries between steps within a plan. DONE (Wave 67).
- [x] **Cross-task context summaries** — completionSummary generated after plan completion, consumed by downstream tasks. DONE (Wave 67).
- [x] **Failure context propagation** — failureContext passed to retried actions. DONE (Wave 67).
- [ ] **Repo file contents in code generation context** — generateCode currently gets a file tree (paths only). It must fetch and include actual file contents (schema, types, routes) so code generated for Task N is consistent with what Tasks 1–(N-1) committed. This is the #1 coherence gap found in the 2026-03-27 pipeline analysis.
- [ ] **Schema-first constraint** — when a Prisma schema (or equivalent) exists, tell the AI explicitly: use these exact models, do not invent new ones.
- [ ] **Dependency-aware execution ordering** — the orchestrator should execute tasks in topological order based on the dependency graph, not just sequentially within a plan.

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
10. Improve `review_pr` to act as a separate skeptical agent — different system prompt focused on security vulnerabilities, code standards, missing error handling, architectural issues. Not just the same AI reviewing its own output uncritically.

**What "done" looks like:** A new user can sign up, create a project, connect GitHub, describe a feature, and get a PR with generated code — without errors, without manual intervention beyond approval gates. Each step's output is visible on GitHub as commits on a feature branch.

**Architecture constraint:** Project ↔ Repo is 1:1 for now. When implementing branch/commit operations, pass repo context per-action (from the project record) rather than assuming a single global repo. This keeps the door open for future monorepo (multiple projects → one repo with path scoping) and multi-repo (one project → multiple repos) support. See decisions.md.

### Phase 1.5: Onboarding redesign — AI-driven scaffold + organic KB seeding

**Goal:** First interaction demonstrates the AI "gets it." User describes a project, AI recommends the right stack, user approves. Knowledge base seeds organically — no interview.

#### Scaffold recommendations

**Current flow:** Create project → wizard shows 4 hardcoded templates → user picks → scaffold
**Target flow:** Create project (with description) → AI generates stack recommendation + 2-3 alternatives with rationale → user approves/picks/describes custom → scaffold

#### Existing repo onboarding

Alternative entry point for users with existing codebases. Instead of "describe what you want → scaffold," it's "here's what I have + what I want → plan."

**Flow:** Connect repo → user provides intent (optional) → AI analyzes codebase (file tree, README, package.json, key files) → generates project description + KB entries + task backlog → user reviews and approves.

**User intent examples:**
- No prompt: "Here's my codebase" → AI suggests what's missing, what needs improvement, what to build next
- Feature request: "I want to add user authentication" → AI plans the feature within existing architecture
- Bug report: "The checkout flow breaks with multiple items" → AI analyzes relevant code, plans a fix
- Redesign: "Migrate from REST to GraphQL" → AI understands scope, breaks into tasks

**Repo provides context, user prompt provides intent.** Together they produce a plan grounded in the actual codebase.

**What exists today:**
- `bootstrapFromRepo` — analyzes repo, generates profile
- `fetchProjectFileTree` — reads file tree
- `generateTaskPlan` / `generateHierarchicalPlan` — generates plans
- GitHub connection flow — working (including personal accounts via OAuth)

**What's needed:**
- Stitch existing features into a single flow: connect repo → analyze → generate plan with user intent as input
- New onboarding path in ProjectSetupWizard alongside the scaffold path
- AI should use repo analysis + user intent + existing KB to produce the plan

**Same destination as new-project flow:** Project with tasks ready for execution. Different starting point.

#### Scaffold recommendations (new projects)

**Implementation:**
1. Remove `scaffoldTemplates` query and hardcoded template list
2. New AI feature `recommendStack` — takes project name + description, returns recommended stack (label, description, rationale, scaffold config) plus 2-3 alternatives. Each option specifies: framework, language, key packages, full-stack vs API-only vs frontend-only.
3. Update `scaffoldProject` mutation — accept structured scaffold config instead of template name string
4. Update `buildScaffoldPrompt` — receive structured config ("full-stack Next.js with PostgreSQL, Prisma, Tailwind") instead of a template name
5. Update ProjectSetupWizard template step — show AI recommendation with rationale, alternatives below, option to describe something custom ("I want this in Python with Django")
6. Recommendation can be pre-fetched in background after project creation to minimize wait time

**What stays the same:** GitHub connection step, scaffold execution (commit to repo), KB auto-population.

#### AI-friendly repo scaffolding

When TaskToad scaffolds or generates code, it should also create AI context files so the repo is immediately usable with Claude Code, Codex, or similar tools:
- `CLAUDE.md` — project context, dev commands, architecture notes (modeled on TaskToad's own CLAUDE.md)
- `.claude-knowledge/` or similar directory with project docs
- These files should reflect what's in TaskToad's knowledge base — KB entries map to repo context files

**Why:** Users who want to hand off to manual AI coding (or use Claude Code alongside TaskToad) get full context for free. TaskToad's own code gen also benefits when reading the repo for context in subsequent steps.

**Implementation:** Add to scaffold prompt — generate AI context files alongside code. Update KB auto-population to also write context files to the repo on changes. Keep in sync: KB update → commit updated context file to repo.

#### Replace onboarding interview with organic KB seeding

**Current:** Multi-question technical interview after project creation → seeds KB entries. Assumes a technical user who knows their stack, deployment, architecture. Bad first experience — too many questions before the user sees any value.

**Target:** Remove the interview. KB seeds itself organically through the project lifecycle:
- Project description (entered at creation)
- Scaffold output (already auto-populates KB — Wave 60)
- AI stack recommendation rationale (Phase 1.5 scaffold)
- User decision points resolved during planning (e.g., "chose in-house auth over Auth0")
- Completed task summaries (Phase 2 context threading)
- Repo analysis (file tree, package.json, README — `bootstrapFromRepo` already exists)
- User can always add KB entries manually via the Knowledge Base panel

**Optional:** Replace interview with one free-text field on project creation: "Anything else the AI should know about this project?" Not required, not a multi-step flow.

**Implementation:**
1. Remove or disable the onboarding interview (`generateOnboardingQuestions`, `saveOnboardingAnswers`)
2. Remove the onboarding wizard modal from ProjectDetail
3. Add optional "Additional context" textarea to project creation form
4. Ensure all organic KB seeding points are working (scaffold, repo analysis, future: decision points and task summaries)

### Phase 2: Context threading + AI collaboration (the real differentiator)

3. Execution result forwarding between steps (structured summaries, not just raw files)
4. Cross-task context summaries — when a task completes, downstream tasks get structured context
5. Dependency-aware execution ordering across tasks
6. Global org/user knowledge base (in addition to per-project KB) — context that spans all projects
7. **Actionable AI project assistant** — ongoing AI collaboration for task management (see "AI as Project Collaborator" section below)

### Phase 3: Orchestration improvements (makes it an autopilot)

6. Dependency inference during decomposition (planner outputs dependency graph)
7. **Sessions — cross-task orchestration** (see "Sessions vs Sprints" section below)
8. Re-planning on failure
9. Parallel execution streams
10. **Bidirectional GitHub sync** — GitHub events (commits, PR merges, issue closes, CI status changes) update TaskToad task state. Currently one-directional (TaskToad → GitHub). Webhook subscriptions exist (push, PR, PR review) but the handler only creates link records, doesn't update task statuses. The orchestration loop needs to watch GitHub and react: PR merged → mark task done → trigger downstream tasks. PR review requested changes → create follow-up action. Direct commit on a task's branch → update task context.

### Phase 4: Competitive moat (later)

10. Agent abstraction (pluggable AI backends — Claude Code, Codex, etc.) + user model/provider selection
11. Merge orchestration + progress dashboard
12. Multi-project orchestration

### Refactoring

A codebase audit was completed (2026-03-25). Refactoring should be done alongside pipeline work, not as a separate phase. When implementing Phase 1, incorporate audit findings for files being touched. See todos.md for the categorized audit items (pre-pipeline, fold-into-pipeline, deferred).

---

## AI as Project Collaborator

The AI should be an ongoing collaborator that understands project state and suggests what's needed — not a one-shot plan generator. All AI suggestions are **actionable** (suggest + one-click apply), not just informational.

**Core principle: AI tools suggest with preview, user approves.** The AI shows exactly what it would change, user clicks "Apply" or edits first. No autonomous creation — the user always sees what's about to change. Future option: "auto-apply" toggle for power users who trust the AI.

**Reactive (user asks):**
- "What tasks am I missing?" → AI reviews existing tasks + repo state, suggests gaps with "Add" buttons
- "Refine this epic" → AI proposes expanded/rewritten spec, user approves changes
- "Is this task ready to execute?" → AI checks instructions, dependencies, repo state — suggests fixes if not

**Proactive (AI suggests):**
- After task completion, AI notices next logical step isn't planned → suggests it
- AI reviews repo and finds drift from task plan → "you have 3 API endpoints not covered by any task"
- After PR review with changes requested → AI suggests follow-up task
- Periodic project health check → "these 2 tasks seem to overlap" or "this dependency is missing"

**Where it lives in the UI:**
- Project-level AI chat (`projectChat` already exists) that can take actions — create/update/delete tasks, not just answer questions
- Inline suggestions on task detail ("this task might need to be split", "consider adding tests")
- "What's next?" button → analyzes project state, suggests highest-priority work with one-click creation

**What exists today (read-only, needs to become actionable):**
- `analyzeTrends`, `projectChat`, `analyzeRepoDrift`, `taskInsights` — all informational
- `generateTaskPlan`, `expandTask` — create tasks but only during initial planning
- The shift: every AI insight should have an "Apply" action attached

**Context sources for AI suggestions:**
- TaskToad project state (existing tasks, statuses, dependencies, completion history)
- GitHub repo state (file tree, open PRs, recent commits, CI status)
- Knowledge base entries
- Execution history (what worked, what failed, what was re-planned)
- Future: external sources (Slack conversations, design docs, issue trackers)

**Architecture note for Phase 1:** Don't make this harder. When building the pipeline, ensure AI features receive and return structured data that can be mapped to mutations. Avoid patterns where AI output is only displayable as text — it should always be parseable into actions.

**Timeline:** Phase 2. Requires Phase 1 (working pipeline) so there's execution context to reason about.

---

## Sessions vs Sprints

Sprints are a human-team concept (time-boxed, capacity-limited, manual assignment). With an AI autopilot, the natural organizing unit is an **execution session** — scope-boxed and budget-limited, not time-boxed.

**Sprint (human concept):**
- Time-boxed (2 weeks)
- Capacity-limited (team size × hours)
- Manual task assignment
- Velocity measured in points/sprint

**Session (autopilot concept):**
- Scope-boxed (N tasks, or "until this milestone")
- Budget-limited (token spend, API cost cap, max failures)
- AI sequences tasks based on dependency graph
- Progress measured in tasks completed, PRs merged, cost spent
- User kicks it off, watches the dashboard, intervenes if needed

A session would be: "Execute these 5 tasks in dependency order. Stop after $10 of AI spend or if a task fails twice."

**Autonomy dial — session configuration:**
Sessions should have configurable autonomy levels. Trust varies by context — routine tasks can auto-run, sensitive changes need approval. Configuration options:
- **Autonomy level:** Fully autonomous (run everything, pause only on failure) / Approve external actions only (PRs, deploys) / Approve every step
- **Budget cap:** Max token spend or dollar amount before pausing
- **Failure policy:** Retry N times then pause / pause immediately / skip and continue
- **Scope limit:** Max tasks per session
- **Time limit:** Optional max duration

These are per-session settings, not global. A user might run a "quick fixes" session fully autonomously and a "new feature" session with step-by-step approval. The current `requiresApproval` field on individual actions is the primitive that supports this — session config would set the default, individual actions could override.

**Relationship to existing features:**
- Sessions are project-level action plans that execute multiple tasks in sequence. Currently action plans are per-task — a session is the cross-task orchestration layer on top.
- Sprints don't go away — they serve the PM dashboard for users who want manual organization. Sessions coexist alongside them. Autopilot users use sessions; manual users use sprints; hybrid users use both.
- Sessions are Phase 3 (cross-task orchestration). Requires Phase 1 (branch-based per-task execution) and Phase 2 (context threading between tasks) first.

**Don't redesign sprints yet.** Keep them as-is for the PM dashboard function. Build sessions as a new concept in Phase 3.

---

## Implementation Game Plan

**For each phase:**
1. **Swarm the implementation** — workers build the tasks from the spec
2. **One manual end-to-end test** after swarm merges — don't test every wave, test every phase
3. **Fix integration issues** in a focused session — pipeline work always has edge cases at the seams
4. **Repeat until the happy path works clean**

**Phase 1 happy path test:** New user → signup → create project → connect GitHub → scaffold → create task → auto-complete → PR on GitHub with bot-attributed commits. If that works, Phase 1 is done.

**Phase 1.5 happy path test:** New user → signup → describe project → AI recommends stack → approve → scaffold. Also: connect existing repo → provide intent → AI generates plan.

**Phase 2+ happy path test:** Multiple tasks execute in sequence. Task #3's code generation reflects what tasks #1 and #2 built. Context flows downstream.

**Pre-pipeline refactors (Wave 61):** Swarm, no manual testing needed. Pure extractions — typecheck + lint + tests passing is sufficient.

**What NOT to do:**
- Don't manually test every swarm wave — waste of time for mechanical changes
- Don't try to catch integration bugs during swarm — workers build isolated slices, integration testing happens after merge
- Don't fix edge cases preemptively — build the happy path first, then fix what breaks during the manual test

---

## AI Identity: Tommy the Toad

All AI interactions should use a consistent persona ("Tommy") — not a gimmick, the face of the autopilot. Post-pipeline polish, but when building AI-facing UI, avoid hardcoding generic language ("AI suggests..."). Use a pattern that can be swapped to Tommy's voice later. Full spec in `branding.md`.

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
