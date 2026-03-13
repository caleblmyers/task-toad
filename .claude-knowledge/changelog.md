# Daily Development Changelog

Summaries of work completed each session. Most recent first.

---

## 2026-03-12 (Session 2)

### PM Platform Gap Analysis & Todo Overhaul

Compared TaskToad against 8 industry PM platforms (Asana, Jira, Linear, Monday, ClickUp, Notion, Wrike, Shortcut). Added 31 missing features across 9 categories to `todos.md`: collaboration (comments, activity feed, @mentions, file attachments), notifications (in-app, email, preferences), views (calendar, timeline/Gantt, table), task management (bulk actions, labels/tags, dependencies UI, rich text, archiving UI, recurring tasks), workflow (custom statuses, automation rules, task templates), reporting (burndown, velocity, dashboard), project management (edit details, portfolio), search (global search, saved filters), integrations (GitHub, Slack, webhooks, API docs), permissions (project-level roles). Added a prioritization section ranking all 58 uncompleted items across 7 tiers.

### Frontend Refactor — ProjectDetail Decomposition

Decomposed `ProjectDetail.tsx` from ~830 lines to ~357 lines (57% reduction). Extracted:
- `hooks/useProjectData.ts` (709 lines) — data fetching, mutations, sprint/task CRUD, AI ops
- `hooks/useTaskFiltering.ts` (63 lines) — search + status/priority/assignee filtering
- `hooks/useKeyboardShortcuts.ts` (100 lines) — j/k/Esc/n keyboard shortcuts
- `hooks/useToast.ts` (26 lines) — toast notification state
- `utils/taskHelpers.ts` (37 lines) — TASK_FIELDS, status↔column mapping
- `components/shared/` (5 files, 367 lines) — SearchInput, FilterBar, Icons, Toast, KeyboardShortcutHelp

Added semantic Tailwind colors (status/priority tokens) and animations (slide-in, fade-in). Removed 5 unused component files and 4 build artifacts.

### AI Subsystem Architecture Refactor

Decomposed monolithic `graphql/ai.ts` (367 lines) into dedicated `src/ai/` subsystem (10 files, 811 lines):

```
src/ai/
  index.ts          — barrel (public API)
  aiTypes.ts        — Zod schemas + inferred types
  aiConfig.ts       — model, per-feature max tokens, cost constants, system prompts
  aiClient.ts       — Anthropic wrapper (client reuse, error mapping, cache, size check)
  aiService.ts      — 6 feature functions with retry-on-validation-failure
  promptBuilder.ts  — per-feature prompt templates with context compression
  responseParser.ts — stripFences + Zod-validated JSON parsing
  tokenEstimator.ts — prompt size estimation + context window guard
  aiLogger.ts       — structured usage logging (feature, tokens, cost, latency, cache)
  aiCache.ts        — in-memory LRU cache (50 entries, TTL-based)
```

New capabilities: client reuse (cached per API key), auto-retry on Zod validation failure, LRU response caching (enabled for summarizeProject, 5min TTL), pre-flight prompt size estimation, structured JSON logging with cost estimates, centralized per-feature config, context compression (truncate descriptions to 200 chars, project text to 400 chars, cap sibling lists at 15), deterministic preprocessing (tasks pre-grouped by status for summaries).

Estimated token savings: summarizeProject ~60-80% reduction, generateTaskInstructions ~20-40% on large projects.

### Documentation

Updated: `todos.md`, `app-overview.md`, `decisions.md`, `CLAUDE.md`, `README.md`, `.gitignore`.

---

## 2026-03-12 (Session 1)

### Auth Flows

- Email verification on signup — `verificationToken` on User, `verifyEmail`/`sendVerificationEmail` mutations, `/verify-email` page, dev fallback logs to console
- Password reset — `resetToken`/`resetTokenExpiry` on User, `requestPasswordReset`/`resetPassword` mutations, `/forgot-password` and `/reset-password` pages
- Org member invite — `OrgInvite` model, `inviteOrgMember`/`acceptInvite`/`revokeInvite` mutations, `orgInvites` query, `/invite/accept` page, Team section in OrgSettings

### Sprint Management

- Sprint edit/delete, apiKeyHint fix, Docker Compose, env validation
- Offset-based pagination, task DnD ordering, drag between sprint sections
- Due dates with color-coded chips, project archiving, sprint velocity display

### Stack & Security

- Rewrote stack: Postgres/Prisma/GraphQL with security hardening (helmet, CORS, rate limiting, AI prompt injection defense, Zod validation)
- Updated README for current stack

### UX

- Skeleton loading states, step-by-step AI progress indicator, input blocking during generation
- Navigation warning during AI ops, AbortController cancellation
- Status ↔ kanban column bidirectional sync, keyboard shortcuts, search + filtering
