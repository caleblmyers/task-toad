# Architectural Decisions

Non-obvious choices and their rationale. Only decisions where the "why" isn't apparent from reading the code. Implementation details are in the code itself — don't duplicate here.

---

## Stack Choices

**Postgres + Prisma over AWS (Cognito/DynamoDB/Lambda):** AWS added complexity and cost for MVP. Local Postgres is simpler, free locally, and Railway runs it for $5/mo. Trade-off: loses serverless scalability. Acceptable for MVP.

**GraphQL (graphql-yoga) over REST:** Single endpoint, frontend requests exactly what it needs, schema serves as API contract for AI-driven development. graphql-yoga chosen over Apollo Server for lighter weight and less boilerplate.

**No Apollo Client / URQL:** Plain `fetch` wrapper (~25 lines). Avoids normalized cache complexity, smaller bundle, explicit control. Trade-off: no automatic cache invalidation — callers manage state manually.

**No Redux/Zustand:** Composite hook pattern (`useProjectData` composing 6 sub-hooks). ProjectDetail page IS the app — coupling is acceptable. Trade-off: state not shareable across unrelated pages.

**Hand-coded SVG charts over Recharts:** Recharts adds ~200KB gzipped. For 4-5 chart types, hand-coded SVG is lighter and gives full design control.

**Vitest over Jest:** Faster, shares Vite config, native ESM, Jest-compatible API.

**Fetch-based SSE over native EventSource:** `EventSource` doesn't support custom headers (needed for JWT) or `AbortController`.

---

## Auth & Security

**HMAC JWT (HS256) over sessions:** Stateless, scales horizontally without session store. Trade-off: can't invalidate individual tokens without blocklist (solved with `tokenVersion` in Wave 35).

**HttpOnly cookies (migrated from localStorage in Wave 42):** Access token (15-min) and refresh token (7-day) delivered via HttpOnly cookies. Secure/SameSite=Strict in production. CSRF via X-Requested-With header.

**API keys on Org, not User:** Multi-tenant — one Anthropic key per org. All members share it. Admin sets via settings. Encrypted with AES-256-GCM.

**tokenVersion for revocation (Wave 35):** Increment on logout/password change. JWT includes `tv` claim checked against DB on every request. Backward-compatible (old tokens without `tv` still work until expiry).

**Bring-your-own-key pattern:** No server-side Anthropic key. Each org provides their own. No `ANTHROPIC_API_KEY` env var needed.

---

## Data Model

**Sprint columns as JSON string array:** Dynamic per-sprint (e.g., "Review", "QA") without schema changes. `sprintColumn` on Task is a string matching one column name.

**Status ↔ column bidirectional sync:** Changing status fuzzy-matches a sprint column and vice versa. Keeps board and list views consistent without requiring 1:1 mapping.

**TaskDependency join table over `dependsOn` string:** Originally a JSON string, migrated in Wave 30. Join table enables cycle detection (BFS), typed link relationships (blocks, relates_to, duplicates), and proper indexing.

**ReleaseTask join table over releaseId FK on Task:** A task can belong to multiple releases. Join table is more flexible.

**SavedFilter extended, not renamed to SavedView:** Added viewType/sortBy/groupBy/visibleColumns/isShared fields to existing model. Backward-compatible — no migration needed for existing data.

---

## Infrastructure

**In-process event bus + job queue over Redis/RabbitMQ:** Single-server MVP. Clean port/adapter interface — swap to Redis Pub/Sub or Bull later by writing new adapter. Advisory locks (PostgreSQL) enable multi-replica safety.

**Single Railway service (API + static frontend):** Express serves `web/dist` in production. No separate frontend deploy needed. Simpler, cheaper.

**S3-compatible storage with local fallback:** File attachments go to S3/R2 if configured, local disk otherwise. Railway has ephemeral filesystem so S3 is required for production persistence.

**No staging environment:** Solo dev MVP. CI validates before merge. Local testing covers most scenarios. Add staging when team grows or customers are paying.

---

## GitHub Integration

**Two GitHub Apps (dev/prod):** `tasktoad-dev` (App ID 3112394) for local development, `tasktoad` (App ID 3080871) for production. Separate apps avoid dev operations touching prod repos.

**Installation tokens for everything except repo creation on personal accounts:** GitHub App installation tokens handle commits, branches, PRs, reviews, merges. But `POST /user/repos` and GraphQL `createRepository` both return 403 "Resource not accessible by integration" with installation tokens on personal accounts. This is a GitHub platform limitation — creating repos on personal accounts requires a user OAuth token regardless of app permissions.

**User OAuth token for personal account repo creation:** Obtained via `/api/auth/github` OAuth flow, stored encrypted in `user.githubTokenEncrypted`. Only used for creating repos on personal accounts. Can go stale if revoked on GitHub's side — user must re-authenticate.

**Auto-reauthentication on 401 for installation tokens:** `githubRequest()` accepts optional `installationId` — on 401, clears cached token and retries with a fresh one. `githubRestRequest()` does the same for REST calls. All GitHub service files pass `installationId` through. OAuth tokens cannot auto-refresh — user must re-authenticate manually.

**SSE compression exclusion:** The `compression()` middleware in Express buffers `res.write()` calls, which breaks SSE real-time delivery. The SSE endpoint (`/events`, `/api/events`) is excluded from compression via a filter function. All SSE writes call `res.flush()` after writing.

---

## AI

**Claude Sonnet 4 as default model:** Upgraded from Haiku 4.5 in Wave 60. Sonnet produces more reliable structured output and better code. Per-feature model override available via `model` field in `FEATURE_CONFIG`.

**Structured output via tool_use:** AI responses use a forced tool call pattern (`tool_choice: { type: 'tool' }`) with Zod-to-JSON-Schema conversion. The tool `input` field is always valid parsed JSON — no stripFences/repairJSON hacks needed. Works on all Claude models.

**Zod validation on all AI responses:** Every response validated through Zod schema. Structured output guarantees valid JSON; Zod catches semantic issues.

**User input in `<user_input>` XML tags:** Prompt injection defense. AI system prompts instruct to treat tagged content as opaque data.

**AI features must be actionable, not just informational:** Every AI suggestion should return structured data that maps to a mutation (create task, update task, add dependency). Avoid patterns where AI output is only displayable as text. This enables one-click "Apply" buttons and future auto-apply. The interaction model is always: AI suggests with preview → user approves → action applied.

**Sequential action plan pipeline:** `generate_code → create_pr → review_pr → fix_review → merge_pr`. Each step depends on the previous. All steps run without approval gates (requiresApproval: false). Branch-based execution with feature branches per task. fix_review fetches actual PR source code to generate accurate fixes. Task status transitions automatically: `todo → in_progress → in_review → done` (with `sprintColumn` synced to keep board view correct).

**Single execution primitive, multiple triggers:** `executeTask(taskId)` is the one function that runs the pipeline for a task. It is triggered by: (1) user clicking Auto-Complete in the UI, (2) a session loop picking the next task, (3) a status-change automation rule. No separate execution logic per trigger — sessions and automations are orchestrators that decide *which* task to run and call the same pipeline. Keep this entry point clean and callable from multiple contexts, not coupled to a specific UI flow.

**Sprints stay, Sessions are coming:** Sprints are a human-team concept (time-boxed capacity). The autopilot needs a different organizing unit: Sessions (scope-boxed, budget-limited execution batches). Sessions are Phase 3 — don't redesign sprints now, don't remove them, build sessions as a new concept alongside them. See autopilot-pillars.md "Sessions vs Sprints" section.

**Project ↔ Repo is 1:1 for now, but don't cement it:** Currently a Project has single `githubRepositoryId/Name/Owner` fields. This is correct for the initial target (solo dev, one project, one repo). Future: monorepo support (multiple projects → one repo with path scoping) and multi-repo (one project → multiple repos for microservices). Don't solve now, but when building pipeline features, pass repo context per-action rather than assuming a global project repo. Keep the door open.

---

## Code Generation Coherence

**File tree is not enough — must read actual file contents (2026-03-27 finding).** The `generateCode` executor fetches the repo file tree (paths only) for context. In a 4-task sprint test, this caused each task to generate conflicting code — three different data models, broken imports across files, dead code. The AI needs to see actual file contents (schema, types, routes) to produce code consistent with what previous tasks committed. This is the highest-leverage improvement remaining.

**Schema-first generation:** When a Prisma schema or equivalent exists, the AI must be constrained to use exactly those models. Without this, each task invents its own model names.

**Sprint close reconciliation:** After all tasks in a sprint merge, a consistency check should verify the codebase builds and imports resolve. This fits naturally in the `closeSprint` flow — detect issues, auto-generate a reconciliation PR if needed.

---

## Pipeline Reliability

**Step-level retry before plan-level replan:** When an action fails, retry the same step up to 3 times (3s, 10s, 30s delays) before escalating to a full plan replan. Most failures are transient (GitHub 404, rate limits, branch out-of-date) and resolve on retry. Full replans regenerate the entire action plan from scratch — wasteful for a temporary hiccup.

**Retryable error classification:** Executors return `{ success: false, retryable: true }` for transient failures. Non-retryable failures (merge conflicts, missing config) skip straight to plan failure. This keeps the retry logic in the executor framework, not in individual executors.

**Startup recovery:** On server start, reset stuck state from before a crash: actions in "executing" >5 min → failed, orphaned in_progress tasks → todo, orphaned running sessions → paused. Prevents stale state from blocking the pipeline after deploys or crashes.

**Webhook-driven CI over polling:** GitHub `check_suite` webhooks notify instantly when CI passes/fails. Polling (`monitor_ci`) is the fallback. Webhooks reduce latency from 30-second poll intervals to near-instant.

---

## Open Source Pivot

**GitHub ate the category (April 2026).** Copilot Coding Agent, /fleet (parallel multi-agent), Mission Control, and Agentic Code Review cover the same space with 100M+ user distribution. A standalone tool can't compete on distribution. Pivoted to open source portfolio piece.

**All features free, billing code preserved.** `getEffectivePlan()` always returns 'paid'. `requireLicense()` calls remain in resolvers as documentation. Stripe integration code stays in the codebase — demonstrates billing engineering without being active. No feature gating, no premium tier.

---

## Sprint vs Session Naming

**UI says "Session", code says "Sprint".** All user-facing labels use "Session" (Create Session, Close Session, Session Velocity, etc.) but all code identifiers, GraphQL schema fields, Prisma models, variable names, and prop names use `sprint` (sprintId, createSprint, Sprint model, etc.).

**Why:** The product concept is "sessions" (scope-boxed autopilot execution), but the underlying data model was built as "sprints." Renaming the data layer would touch 45+ files, 770+ references, GraphQL schema, Prisma migrations, and the database. Not worth it — the user never sees the code. The UI label change is sufficient.

**Rule:** When adding new UI text, use "Session." When writing code, use `sprint` for the data model. Never mix — don't create a `Session` model or `sessionId` field that conflicts with the existing `Session` model (which is the orchestration session, a different concept).
