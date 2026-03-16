# Daily Development Changelog

Summaries of work completed each session. Most recent first.

---

## 2026-03-16

### Wave 10: P2 + A11 + I1 (3 workers, 6 tasks)

**P2 — Security Hardening (Worker 1):**
- GraphQL query depth limit (max 10) via custom validation rule in schema.ts
- `bulkUpdateTasks` now verifies per-project access (was only checking org membership)
- Comment mention regex hardened: tighter email pattern, 20-mention cap, batched DB lookups
- Per-user SSE connection limit (max 5, evicts oldest on overflow) in sseManager
- SSE token moved from query string to Authorization header (fetch-based client replaces native EventSource)
- Export endpoints rate limited to 5 requests per 10 minutes per IP

**A11 — Accessibility (Worker 2):**
- Form label associations: htmlFor/id pairs on TaskFieldsPanel (6 fields), SprintCreateModal (5 inputs), SprintPlanModal (2 inputs); aria-labels on FilterBar selects, CSVImportModal mapping selects
- Color contrast fixes: text-slate-300 → text-slate-500 on light backgrounds in FilterBar, CSVImportModal, SprintPlanModal
- KanbanBoard Up/Down arrow reordering within columns with aria-live announcements
- BacklogView sprint picker: keyboard-accessible via M key on focused task rows, with screen reader announcements

**I1 — Integration Completeness (Worker 3):**
- HTML email templates wired into all 4 sendEmail calls in auth.ts (verify, resend, reset, invite)
- Webhook retry processor wired into server lifecycle (startRetryProcessor on startup, stopRetryProcessor on shutdown)
- SSE connection cleanup added to graceful shutdown handler
- Email retry wrapper: 3 attempts with exponential backoff (1s/5s/15s)
- Slack user mapping: SlackUserMapping Prisma model + migration, GraphQL CRUD, `/tasktoad list` filters by mapped user, `/tasktoad create` auto-assigns, SlackSettings UI for managing mappings

**Open follow-ups from Wave 10:**
- [ ] GraphQL complexity/cost limits (depth done, cost analysis not yet)
- [ ] KanbanBoard reorder persistence — Up/Down moves are local state only, need `reorderTask` mutation
- [ ] BacklogView sprint picker: close on Escape/click-outside
- [ ] Slack user mapping self-service — `/tasktoad link` command for non-admin users
- [ ] Full WCAG AA 4.5:1 color contrast audit across all components

### S1: Branding & Design System

- **CSS custom properties** + **Tailwind brand tokens**: `--brand-green`, `--brand-lime`, `--brand-dark`, `--brand-cyan`, `--brand-green-light`, `--brand-green-hover` — defined in `:root` and referenced via `brand.*` in tailwind.config.js
- **Logo deployed** to `apps/web/public/`: `logo.png` (T-Frog), `logo-data.png` (Node Frog), `favicon.png`
- **Meta tags**: favicon, description, theme-color, og:title/description/image/type in `index.html`
- **Logo placements**: sidebar header (28px), login/signup (40px centered), home page (64px centered), project dashboard (32px data logo)
- **Brand-green CTA buttons**: Home page generate, login sign-in, signup create account, TaskPlanApprovalDialog approve
- **Full button color migration**: all action buttons across 35 files converted from `bg-slate-800/700` to `bg-brand-green`/`hover:bg-brand-green-hover` — pages (ProfilePage, ResetPassword, NewProject, CreateOrg, VerifyEmail, OrgSettings, Projects, AcceptInvite, ForgotPassword, ProjectDetail) and components (ProjectSettingsModal, WebhookSettings, SlackSettings, GitHubRepoModal, AIUsageDashboard, ErrorBoundary, SprintPlanModal, CSVImportModal, PRDBreakdownModal, BugReportModal, CommentSection, SprintCreateModal, SprintTransitionModal, MeetingNotesDialog, CloseSprintModal, BatchCodeGenModal, ProjectChatPanel, MarkdownEditor, TaskSubtasksSection)
- **Focus ring migration**: all `focus:ring-slate-400` → `focus:ring-brand-green` across 19 files (inputs, textareas, selects)
- **Active tab/toggle indicators** → `bg-brand-green`: AIUsageDashboard, BurndownChart, ProjectChatPanel, TaskPlanApprovalDialog step indicator
- **Loading spinner branding**: `border-t-slate-700` → `border-t-brand-green` in App.tsx, OrgSettings, TaskPlanApprovalDialog
- **Unchanged (intentional)**: sidebar bg-slate-800 (dark chrome), BulkActionBar (dark floating toolbar), text colors (semantic), status/priority colors (separate system)
- **Branding knowledge base** updated: `.claude-knowledge/branding.md` with deployed assets, color tokens, and UI placement reference

### Wave 9: P1 + A11 + I1 (3 workers, 6 tasks)

**P1 — Production Hardening (Worker 1):**
- Graceful shutdown handlers (SIGTERM/SIGINT) with Prisma disconnect, interval cleanup, 10s force-kill timeout
- Startup DB connectivity check, production env warnings for missing SMTP/API keys
- React Error Boundary with fallback UI + Suspense wrapper for lazy routes
- Static asset caching: immutable for hashed assets, no-cache for index.html

**A11 — Accessibility Foundation (Worker 2):**
- Shared `<Modal>` component with focus trap, aria-modal, aria-labelledby, Escape-to-close, focus restoration
- All 19 modal/dialog components converted to use shared Modal
- ARIA labels on icon-only buttons, aria-hidden on decorative SVGs
- ToastContainer live regions (aria-live="polite", role="alert" for errors)
- Skip-to-content link, sidebar nav aria-label, notification badge announcements
- KanbanBoard keyboard navigation: Enter/Space move mode, arrow keys between columns

**I1 — Integration Completeness (Worker 3):**
- WebhookDelivery model + migration, exponential backoff retry queue (5s→1hr, 5 attempts max)
- Webhook delivery dashboard UI with status badges, replay button for failed deliveries
- Fixed missing webhook dispatches for comment.created and sprint.created events
- Slack slash commands: `/tasktoad list` (assigned tasks) and `/tasktoad status` (project summary) with Block Kit
- Branded HTML email templates for verification, password reset, and invite emails

**Pre-wave:** Adaptive AI generation limits — replaced hardcoded output count ranges with scope-aware guidance, added delegationHint to code generation, bumped token ceilings

**Open follow-ups:**
- Wire `startRetryProcessor()` into `index.ts` (exported but not called — retry processor won't run until integrated)
- Wire HTML email templates into auth resolver `sendEmail()` calls (templates built but callers still pass plain text)
- Slack `/tasktoad list` shows all tasks, not user-specific (blocked on Slack user mapping)

**Process notes:**
- Worker-3 couldn't wire retry processor into index.ts because it wasn't in their files array. Future: include entry point files when tasks add background processors.
- Worker-1 delivered both tasks cleanly — zero type errors, no lint regressions across 13 files.

### Wave 8: W1 + W2 (2 workers, 2 tasks completed, 1 deferred)

**W1 — API Quality (Worker 1):**
- Fixed inconsistent mutation return types — `deleteComment` returns deleted Comment, `markAllNotificationsRead` returns count
- Added cursor-based pagination to `activities` and `reports` queries (ActivityConnection, ReportConnection)
- Auto-generated API docs served at `GET /api/docs`

**W2 — Custom Fields & Saved Filters (Worker 2):**
- Custom fields on tasks — CustomField + CustomFieldValue models, 4 field types (text, number, date, dropdown), CRUD mutations, TaskDetailPanel rendering, FilterBar integration, ProjectSettingsModal management
- Saved filters/views — SavedFilter model, save/load/delete in FilterBar

**Deferred:** Task templates, file attachments, recurring tasks (moved back to W2 todos for future wave)

**Codebase audit:** Added 8 new work sets to todos.md — P1 (production hardening), P2 (security), A11 (accessibility), Q1 (code quality/testing), D1 (deployment/observability), I1 (integration completeness), F1 (frontend performance), S1 (styling/branding)

**Process notes:**
- Worker-2 submitted without running `prisma generate` — 17 typecheck errors caught by reviewer. Future: task descriptions must include "run `npx prisma generate` AND `pnpm typecheck`" for schema changes.
- JSON column cleanup sub-item was skipped by worker. Future: mark optional sub-items explicitly or split into separate tasks.
- Worker modified files not in task's `files` array (auth.prisma, org.prisma, resolvers/index.ts) — necessary for Prisma relations. Future: include related model files in files array.

### Wave 7: W1 + W5 + W6 (3 workers, 5 tasks)

**W1 — API Refactor & Security Hardening + Frontend Cleanup:**
- Extracted `requireTask`/`requireProject`/`validateStatus` resolver utilities (eliminated 20+ duplicated blocks)
- Added GraphQL error codes in extensions, Zod input validation at resolver boundaries
- Sanitized AI prompt injection, added CSP headers, rate-limited password reset/verification
- Decomposed BacklogView, lazy-loaded react-markdown, refactored setState injection

**W5 — Slack Integration:**
- Full vertical slice: SlackIntegration model, Slack client with Block Kit formatting
- Notification dispatch alongside webhooks, slash command endpoint for task creation
- GraphQL CRUD + SlackSettings UI in OrgSettings

**W6 — Views & AI History:**
- Timeline/Gantt SVG chart with dependency arrows and day/week/month zoom
- Portfolio overview page with cross-project health scores and metrics
- AIPromptLog model with automatic persistence in AI client
- Historical trend analysis (analyzeTrends query + TrendAnalysisPanel)

**Process notes:**
- Worker-3 had merge conflict after first task merged (multi-task same branch). Future: workers should rebase between tasks.
- Missing Prisma migration caught by reviewer. Future: always include "run prisma migrate" in task descriptions for schema changes.

---

### Wave 6: W1 + W3 + W4 + W5 + W6 (3 workers, 10 tasks)

**W1 — Frontend Architecture Refactor (partial):**
- Split `useProjectData.ts` into focused hooks (`useTasks`, `useSprintManagement`, `useAIGeneration`, `useProjectUI`)
- Decomposed `TaskDetailPanel.tsx` into sub-components
- Added `useMemo`/`useCallback` memoization to KanbanBoard and BacklogView
- Extracted GraphQL query strings into `queries.ts`

**W3 — Users, Roles & Automation:**
- User avatars and profile management (display name, timezone, notification prefs)
- Project-level roles (viewer, editor, admin) with permission checks in resolvers
- Automation rules engine with configurable triggers and rule builder UI

**W4 — AI Power Features:**
- Task dedup (prevent AI from generating duplicate tasks)
- Bug report → Task parser with BugReportModal UI
- PRD → Task breakdown with preview/commit flow
- Sprint transition analyzer (AI analyzes backlog on sprint close)
- GitHub repo → Project bootstrap (import repo, AI generates initial tasks)

**W5 — External Integrations (partial):**
- Outgoing webhooks with HMAC signing, retry queue, management UI
- Real-time SSE updates with auth, `useEventSource` hook, live UI patching

**W6 — AI Extras (partial):**
- Contextual project chat — NL Q&A grounded in live project data
- Repo ↔ Task drift analysis — flags outdated/untracked work
- Batch code generation — multi-task code gen in one PR

---

## 2026-03-14

### Production Deployment

- Deployed to Railway (Hobby plan): single service serving both API + web frontend
- Dockerfile: multi-stage build with OpenSSL for Prisma, ESM `__dirname` fix
- API serves Vite build as static files in production (no separate web service needed)
- Railway auto-deploys, auto-migrates via `prisma migrate deploy` in startCommand
- Fixed: Prisma generate must run before tsc in Docker, `cd` not available in slim containers
- Manually linked GitHub App installation in prod DB (owner redirect limitation)
- Skipped email verification redirect for MVP (SMTP not configured)
- Production URL: `https://tasktoad-api-production.up.railway.app`

### "In Review" Status + PR Lifecycle

- Added `in_review` as default status and "In Review" as default kanban column
- Auto-move task to `in_review` when PR is created via `createPullRequestFromTask`
- Auto-move task to `done` when PR receives approved review via `pull_request_review` webhook
- Swapped column colors: In Review = purple, Done = green

### GitHub Integration Fixes

- Fixed webhook signature verification: `express.raw()` before `express.json()`
- Fixed PKCS#1 → PKCS#8 key conversion for jose (GitHub generates PKCS#1 keys)
- Base64-encoded private key in `.env` (multi-line PEM not supported by Node env loading)
- GitHub App transferred to `tasktoad` org
- Popup-based GitHub App installation flow

### Swarm System v2

- Restructured todos from 15 file-based groups into 18 parallel-optimized Task Sets
- Schema sets (S1-S10) run one at a time; Independent sets (I1-I8) run freely in parallel
- Planner auto-selects work by priority (no manual set specification needed)
- Added `task-update.sh` and `merge-worker.sh` helper scripts
- Workers loop until all tasks merged, auto-rebase, self-fix on review feedback
- Added `.claude/settings.json` with project-level permissions (auto-allow safe commands)

### Wave 2: S2 + I2 + I4 (3 workers, 8 tasks)

**S2 — AI Persistence & Cost Control:**
- AIUsageLog model with per-call tracking (feature, tokens, cost, latency)
- Org budget fields (monthlyBudgetCentsUSD, alertThreshold)
- aiUsage query with per-feature breakdown and budget usage percentage
- setAIBudget mutation for org admins
- Persisted reports model (standup, sprint, health) for historical analysis
- AI Usage Dashboard in OrgSettings with cost cards, feature table, budget controls

**I2 — Code Gen UX:**
- Regenerate single file in code preview modal with optional feedback
- Code gen templates / style guides — per-project localStorage with prompt injection

**I4 — Frontend Views:**
- Burndown/burnup SVG chart using existing sprintBurndown query
- DependencyBadge component with hover tooltip and blocked indicators
- Cross-project search page with debounced input, grouped results

### Wave 1: S1 + I1 + I3 (3 workers, 9 tasks)

**S1 — Core PM Foundation:**
- Epics / task hierarchy with taskType field (epic → story → task → subtask)
- createSubtask mutation with auto type inference, Task.children + Task.progress field resolvers
- Epic grouping in BacklogView with expand/collapse and progress bars
- Task type badges (purple=epic, blue=story) on KanbanBoard and TaskDetailPanel
- Sprint goal field on Sprint model + SprintCreateModal UI
- Story points on Task model + TaskDetailPanel input + BacklogView display
- Sprint velocity now tracks both hours and points

**I1 — AI Pipeline Polish:**
- AI-generated commit messages (conventional commits format) with graceful fallback
- AI-enriched PR descriptions (summary, changes, testing sections)
- Multi-file context injection — fetches project file tree from GitHub for code gen prompts
- Pre-flight cost estimation display in CodePreviewModal

**I3 — Infrastructure:**
- GitHub Actions CI workflow (lint, typecheck, build on push/PR)
- Deploy workflow (placeholder, builds successfully)
- Multi-stage Dockerfile for API
- Railway deployment config with auto-migration
- DEPLOY.md documentation

### Swarm: Code generation pipeline + AI UX (Groups A, B)

Second swarm run — 3 workers, 5 tasks.

**Group A — AI Code Generation Pipeline:**
- Backend: `generateCode` in aiService + Zod schema + promptBuilder + aiConfig (8192 max tokens)
- GraphQL: `generateCodeFromTask` mutation with `GeneratedFile` and `CodeGeneration` types
- Frontend: `CodePreviewModal` with collapsible file previews, token cost display, "Create PR" button
- Full flow working: Task → Generate Instructions → Generate Code → Preview → Create PR on GitHub

**Group B — AI Generation UX:**
- Graceful rejection handling — after 3 rejections, shows context input for better results
- Iterative generation input — collapsible "Refine" section with refinement history

### GitHub integration fixes

- Fixed webhook signature verification: `express.json()` was parsing body before webhook route, breaking HMAC
- Fixed PKCS#1 → PKCS#8 key conversion for `jose` (GitHub generates PKCS#1 keys)
- Base64-encoded private key in `.env` (multi-line PEM not supported by Node env loading)
- GitHub App transferred to `tasktoad` org
- Popup-based GitHub App installation flow (replaces full-page navigation)

### Swarm improvements

- Added `task-update.sh` and `merge-worker.sh` helper scripts (reduces manual approvals)
- Workers now loop until all tasks merged, auto-rebase, self-fix on review feedback
- No remote pushes from workers/reviewer — only user pushes from main
- Added cross-group blocker isolation rules to planner

### Todos expansion

- Added 25 new feature items across PM parity gaps and AI pipeline enhancements
- New groups: M (User & Profile), N (Real-time), O (Data Portability)

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
