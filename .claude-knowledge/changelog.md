# Daily Development Changelog

Summaries of work completed each session. Most recent first.

---

## 2026-03-14

### Swarm: Groups J, A, C (parallel development)

First swarm run — 3 workers + reviewer, 10 tasks across 3 groups.

**Group J — API Architecture (Tech Debt):**
- Split monolithic schema.ts (~2000 lines) into 10 domain resolver modules under `resolvers/`
- Added structured GraphQL error handling (7 error classes + requireAuth/requireAdmin guards)
- Added structured logging with pino (replaced all console.error/log calls)

**Group A — AI Reports:**
- Daily standup report — AI generates completed/inProgress/blockers from sprint data
- Sprint report — AI summary with completion rate, highlights, concerns, recommendations
- Project health analyzer — AI health score (0-100) with issues, strengths, action items
- Meeting notes → Tasks — AI extracts tasks from pasted meeting notes

**Group C — GitHub Integration:**
- GitHub issue sync — create GitHub issues from tasks, bidirectional status sync
- PR status on tasks — show linked PR status (open/merged/closed) on task cards
- Auto-link commits — parse branch names to associate commits with tasks

---

## 2026-03-13

### Tier 1 & 2 Features (table stakes + standard)

Implemented all Tier 1 and Tier 2 features from the PM gap analysis. 31 files changed, ~4,800 lines added.

**Collaboration:**
- Threaded comments on tasks with edit/delete
- Activity feed (project-level and per-task)
- @mentions with autocomplete dropdown

**Views:**
- Table view with inline editing (status, assignee, due date, sprint)
- Calendar view (tasks plotted by due date, month navigation)
- Project dashboard with stats, charts, and activity feed

**Task management:**
- Bulk actions bar (multi-select → update status/assignee/sprint/archive)
- Custom statuses per project (add/remove from toolbar)
- Labels/tags system (create, color-pick, assign to tasks, filter by label)
- Markdown editor/renderer for task descriptions
- Task archiving UI with "show archived" toggle

**Reporting:**
- Burndown/burnup chart (per-sprint, SVG-based)
- Sprint velocity chart (completed tasks/hours across sprints)

**Navigation:**
- Global search modal (Cmd+K) — searches tasks and projects across org
- Notification center in app header (bell icon, unread count, mark-read)

**Backend:**
- New Prisma models: Comment, Activity, Label, TaskLabel, Notification
- New migration with all new tables and indexes
- Activity logging utility, notification creation utility
- 742 new lines in schema.ts (resolvers for comments, activities, labels, notifications, stats, search, bulk updates)

**Todos reorganization:**
- Converted from priority tiers to module-based groups (A–L) for parallel development
- Removed all completed items

### GitHub App Integration

Full GitHub App backend + frontend linking UI. 26 files changed, ~2,000 lines added.

**Backend (`apps/api/src/github/`):**
- `githubAppAuth.ts` — JWT generation (RS256), installation token caching with 1-min-before-expiry refresh
- `githubAppClient.ts` — GraphQL client for GitHub API
- `githubRepositoryService.ts` — connect/disconnect repos, create repos, list installation repos (REST)
- `githubCommitService.ts` — create branches, commit files via GitHub GraphQL
- `githubPullRequestService.ts` — create PRs
- `githubService.ts` — orchestration (create PR from task)
- `githubWebhookHandler.ts` — handles installation created/deleted events
- `githubTypes.ts` — shared interfaces
- `githubLogger.ts` — structured logging

**GraphQL:**
- Types: `GitHubInstallation`, `GitHubRepoLink`, `GitHubPullRequest`, `GitHubRepo`
- Queries: `githubInstallations`, `githubInstallationRepos`, `githubProjectRepo`
- Mutations: `linkGitHubInstallation`, `connectGitHubRepo`, `disconnectGitHubRepo`, `createGitHubRepo`, `createPullRequestFromTask`
- `githubRepositoryName`/`githubRepositoryOwner` fields on `Project` type

**Frontend:**
- `OrgSettings.tsx` — GitHub section showing installations with "Connected" badges, auto-links on callback redirect (`?installation_id=`), "Install GitHub App" button
- `GitHubRepoModal.tsx` — two-state modal (connected: show repo + disconnect; not connected: installation dropdown → repo list with filter → connect)
- `ProjectDetail.tsx` — GitHub icon button in toolbar showing `owner/repo` label, opens modal
- `IconGitHub` component added to shared Icons

**Prisma:**
- `GitHubInstallation` model + GitHub fields on `Project` (repositoryId, name, owner, installationId, defaultBranch)

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
