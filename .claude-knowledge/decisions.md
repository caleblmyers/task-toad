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

**JWT in localStorage (current) — migration planned:** H-1 in security audit. Will migrate to HttpOnly cookies + refresh token rotation. Current approach is XSS-vulnerable.

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

## AI

**Claude Haiku 4.5 over Opus/Sonnet:** ~20× cheaper than Opus. Fast enough for structured generation tasks. Per-feature config with different maxTokens and cache TTLs.

**Zod validation on all AI responses:** Never trust AI output with bare `as T` casts. Every response parsed through a Zod schema — invalid responses trigger retry or graceful failure.

**User input in `<user_input>` XML tags:** Prompt injection defense. AI system prompts instruct to treat tagged content as opaque data.

**Sequential action plan pipeline:** generate_code → create_pr → review_pr. Each step depends on the previous. Approval gates let users review before proceeding.

---

## Code Generation Coherence (Planned/Partial)

- Architecture Plan generation before code gen (provides project context)
- GitHub repo as code context for generation
- Model selector (Haiku for plans, Sonnet for code)
- Dependency-aware batch generation
- Reconciliation pass for cross-file consistency
