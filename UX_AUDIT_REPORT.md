# Professional UX Audit Report

## Executive Summary
TaskToad has feature breadth, but the UX maturity is still MVP-grade rather than launch-grade SaaS. The strongest parts are the protected shell in `apps/web/src/App.tsx`, the modal foundation in `apps/web/src/components/shared/Modal.tsx`, and the dashboard/portfolio surfaces in `apps/web/src/components/ProjectDashboard.tsx` and `apps/web/src/pages/Portfolio.tsx`. The weakest parts are the core project workspace in `apps/web/src/pages/ProjectDetail.tsx`, the settings/admin information architecture in `apps/web/src/pages/OrgSettings.tsx`, and search/discovery flows in `apps/web/src/components/GlobalSearchModal.tsx` and `apps/web/src/pages/Search.tsx`.

The main launch risk is not visual polish alone. It is workflow trust. Search does not reliably take users to the exact item they selected, high-value routes are undiscoverable, primary actions compete in one overloaded toolbar, and many failure states are either muted or ignored. That puts the app below the UX standard of Linear, Notion, GitHub Projects, and Jira even where feature breadth is competitive.

## Critical UX Issues
1. Search-to-action is broken or incomplete. `GlobalSearchModal` sends task results only to the project page, not the task, and `Search.tsx` generates a `?task=` deep link that I could not find consumed anywhere in `useProjectData` or `ProjectDetail`.
2. The main workspace is overloaded. `ProjectDetail.tsx` tries to be backlog, board, reporting hub, AI control center, sprint manager, import/export center, and settings surface at the same time. The result is clutter, poor prioritization, and weak scanability.
3. Navigation is incomplete. `App.tsx` exposes a `portfolio` route, but `AppLayout.tsx` does not expose it in the main sidebar. There is no active nav treatment either because the shell uses `Link` rather than `NavLink`.
4. Admin/settings IA is too dense. `OrgSettings.tsx` stacks org config, invites, GitHub installs, Slack, webhooks, and AI usage in one narrow page. It feels like an internal admin dump, not a product-quality settings center.
5. Accessibility is not launch-ready. Auth and onboarding pages such as `Login.tsx`, `Signup.tsx`, `CreateOrg.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, and `AcceptInvite.tsx` depend heavily on placeholder-only inputs. `TaskTitleEditor.tsx` and the project title edit in `ProjectDetail.tsx` rely on clickable headings instead of explicit controls.
6. Error handling is too quiet. `Projects.tsx`, `useProjectData.ts`, `useTaskCRUD.ts`, `NotificationCenter.tsx`, and other surfaces often swallow exceptions or only log them, which creates stale UI and weak recovery.

## Application Structure Assessment
- The route structure in `apps/web/src/App.tsx` is clear and sensible: public auth routes, onboarding, then a protected `/app` shell.
- The layout hierarchy in `apps/web/src/pages/AppLayout.tsx` is simple and understandable, which is good for scale at the shell level.
- The architecture stops scaling well once a user enters `ProjectDetail.tsx`. Too much capability is concentrated into one page rather than distributed into secondary routes or clearer sub-surfaces.
- Page composition is inconsistent. `Portfolio.tsx` and `ProjectDashboard.tsx` show disciplined card-based composition, while `ProjectDetail.tsx` and `OrgSettings.tsx` become dense feature containers.
- Component reuse is partial. Shared primitives exist in `apps/web/src/components/shared`, but the system is shallow. There is no strong reusable form/input/card/section layer, so styling and behavior drift.
- State management is workable but brittle. `useProjectData.ts` and `useTaskCRUD.ts` are large orchestration hooks with many responsibilities and manual fetch/refetch behavior. This can ship, but it will become harder to keep UX consistent as the product grows.

Verdict: the UI architecture scales at the route/shell layer, but not at the primary workspace layer.

## Navigation And Information Architecture
### Navigation UX Issues
- The main sidebar in `AppLayout.tsx` omits `Portfolio`, even though it exists as a first-class route.
- There is no active-state affordance in the main navigation, which weakens orientation.
- `GlobalSearchModal.tsx` and `Search.tsx` behave differently, so the app teaches two search mental models.
- `Search.tsx` appears to promise exact task deep-linking, but I found no corresponding query-param handling in `useProjectData.ts`.
- `NewProject.tsx` depends on `location.state` and redirects to `/app` on refresh. That means the user can lose context mid-flow.
- `OrgSettings.tsx` bundles too many admin domains into one page instead of separate settings categories.
- The home route is labeled “New Project” in the sidebar, but it is functionally an AI-first project generation prompt. The label is serviceable, but the information scent is weaker than it should be.

### Navigation Improvement Plan
- Add `Portfolio` to the main sidebar and convert nav items in `AppLayout.tsx` to `NavLink` with visible active states.
- Unify search behavior so both quick search and full search take users to the exact task, open its panel, and preserve back-navigation context.
- Split `OrgSettings.tsx` into sections or tabs: `Organization`, `Team`, `Integrations`, `Automation`, `Usage/Billing`.
- Persist `NewProject` state in URL params, local storage, or server-side draft state so refresh does not destroy progress.
- Reduce mode switching inside `ProjectDetail.tsx` by moving low-frequency admin/automation actions into secondary panels or menus with stronger grouping.

## Interaction Design
### Interaction Design Problems
- Common project actions are too same-weight in `ProjectDetail.tsx`. “Add task”, “Regenerate”, “Summarize”, “Standup”, “Health”, “Trends”, “Transition”, “Notes”, “Bug”, “PRD”, “Bootstrap”, “Template”, and “Import/Export” all compete in one band.
- Project rename and task rename are hidden behind clickable text in `ProjectDetail.tsx` and `TaskTitleEditor.tsx`, which is low-discoverability and poor for keyboard users.
- `useKeyboardShortcuts.ts` is a good start, but the surrounding UI does not visibly reinforce a keyboard-first workflow the way Linear does.
- `Modal.tsx` traps focus, but it does not lock background scroll or make the page inert, so dialogs feel less contained than they should.
- Destructive flows in `ProjectDetail.tsx`, `SlackSettings.tsx`, `WebhookSettings.tsx`, `SprintSection.tsx`, and `useProjectData.ts` still use native `confirm()`, which is inconsistent and low-context.
- CSV import in `CSVImportModal.tsx` allows mapping more fields than the import actually uses, which is misleading interaction design.
- `Projects.tsx` is too minimal for a core navigation surface. It has no sort, no filter, no status summary, and weak action clarity.
- `NotificationCenter.tsx` is functional but basic. It behaves more like a debug utility than a polished inbox.

### Suggested Interaction Improvements
- Break the `ProjectDetail` header into primary actions, view controls, and secondary utilities. Keep only 2-3 primary actions visible.
- Replace click-to-edit headings with explicit edit buttons or inline edit affordances that are keyboard reachable.
- Replace all native confirms with product dialogs that explain consequences and recovery.
- Make quick search behave like a command palette, not just a small modal search box.
- Turn project/task search into a fully trustworthy action: exact destination, keyboard navigation, recent items, and predictable close/back behavior.
- Make CSV import honest: either support the displayed fields or remove them from the mapping UI.
- Add richer list actions and metadata to `Projects.tsx`: health, last updated, task counts, filters, sorting, archived toggle placement.

## Visual Design And Hierarchy
### Visual Design Assessment
- The app shell in `AppLayout.tsx` is visually coherent and product-like.
- `ProjectDashboard.tsx` and `Portfolio.tsx` show the strongest hierarchy in the product: clean cards, restrained emphasis, and understandable stats.
- `ProjectDetail.tsx` has the weakest hierarchy. It compresses too many functions into one surface with insufficient grouping and too many similarly styled controls.
- `OrgSettings.tsx`, `SlackSettings.tsx`, and `WebhookSettings.tsx` look operational rather than intentional. They read like admin forms, not polished SaaS settings surfaces.
- `Search.tsx` is useful but visually generic and lighter-weight than the rest of the app.
- `index.css` and `tailwind.config.js` define only a thin token layer, so most visual decisions are happening ad hoc in component files.

### UI Consistency Issues
- There is no robust design-system layer for inputs, selects, cards, or section headers.
- Raw Tailwind buttons and shared `Button` usage are mixed inconsistently across the app.
- `Button.tsx` does not define focus-visible treatment, and many raw controls omit focus styling entirely.
- Iconography is inconsistent: shared icons, inline SVGs, ASCII arrows, and emoji all appear across the app.
- Dark mode coverage is uneven. Files like `Search.tsx`, `CreateOrg.tsx`, `NotificationCenter.tsx`, and `RouteErrorBoundary.tsx` skew light-mode.
- Radius, border, and typography choices drift between files because they are not strongly tokenized.

### Suggested Improvements
- Introduce shared primitives for `Input`, `Textarea`, `Select`, `Card`, `Badge`, and `SectionHeader`.
- Normalize iconography and remove emoji/ASCII UI tokens from product-critical controls.
- Create a page composition standard for dashboard pages, list pages, workspace pages, and settings pages.
- Reduce toolbar density and increase section contrast in `ProjectDetail.tsx`.
- Bring dark-mode parity to all top-level pages and overlays.

## Accessibility
### Accessibility Problems
- Placeholder-only auth/onboarding inputs in `Login.tsx`, `Signup.tsx`, `CreateOrg.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, and `AcceptInvite.tsx` fail basic usability and accessibility expectations.
- `SearchInput.tsx` has no explicit label API, which means instances like the task search in `ProjectDetail.tsx` rely on placeholder text for meaning.
- `TaskTitleEditor.tsx` and the project title edit in `ProjectDetail.tsx` use headings as interactive controls.
- `Button.tsx` lacks explicit focus-visible styling, and many raw buttons only style hover states.
- `Modal.tsx` does not appear to lock background scroll or isolate background content for assistive tech.
- `NotificationCenter.tsx` uses menu semantics for what is effectively a notification list/navigation surface, which is semantically questionable.
- Dark-mode and contrast treatment are inconsistent across pages, especially lighter admin and error surfaces.

### Accessibility Improvement Plan
- Replace placeholder-led auth/onboarding forms with persistent labels and help text.
- Add `aria-label` support or visible labels to shared inputs like `SearchInput.tsx`.
- Replace interactive headings with buttons or editable controls announced properly to assistive tech.
- Add consistent `focus-visible` styles across `Button.tsx` and shared/raw controls.
- Add background scroll lock and stronger modal isolation in `Modal.tsx`.
- Audit semantic roles in overlay components like `NotificationCenter.tsx`.
- Run a dedicated keyboard-only and screen-reader pass before launch.

## Error Handling And Edge Cases
### Missing UX States
- `Projects.tsx` hides fetch and archive failures.
- `useProjectData.ts` and `useTaskCRUD.ts` frequently ignore failed network calls and rely on silent refetch behavior.
- `NotificationCenter.tsx` logs failures but does not present a user-facing error state.
- `Search.tsx` ignores search failures instead of giving recovery guidance.
- `NewProject.tsx` loses progress on refresh.
- `RouteErrorBoundary.tsx` is generic and visually disconnected from the rest of the app.
- Empty states are uneven. Some are adequate, but many are text-only and do not help users decide what to do next.

### Recommended Error UX Patterns
- Add consistent inline error banners and retry actions for all primary pages.
- Standardize empty-state design: what happened, why it matters, what to do next.
- Distinguish “no results”, “not loaded”, and “failed to load”.
- Preserve in-progress work for multi-step flows like project creation and imports.
- Show optimistic rollback feedback when mutations fail, rather than silently refetching.

## Performance UX
### Perceived Performance Issues
- The app has some good skeleton usage in `Skeleton.tsx`, `Search.tsx`, `Portfolio.tsx`, and `ProjectDetail.tsx`.
- Mutations in `useTaskCRUD.ts` are often optimistic, which helps responsiveness.
- Realtime is underused. `useEventSource.ts` connects, but `AppLayout.tsx` currently treats incoming events as a no-op, so the user sees a “Live” badge without much live UI benefit.
- Notification count is still polled every 60 seconds in `AppLayout.tsx`, which weakens the value of SSE.
- Some flows give weak progress feedback. CSV import is the clearest example.
- Many error catches fail silently, which makes slow or failed operations feel like nothing happened.

### Performance UX Improvements
- Wire SSE events into targeted UI updates instead of a passive live badge.
- Standardize optimistic updates plus visible rollback errors.
- Use progressive, truthful progress indicators for long-running imports and AI operations.
- Add lightweight refresh/retry affordances where data can go stale.
- Maintain skeleton quality across all high-traffic list/detail surfaces.

## Component Architecture
### Frontend Architecture Review
- The codebase has the beginnings of a design system in `apps/web/src/components/shared`, but it is not strong enough to enforce consistency.
- `useProjectData.ts` and `useTaskCRUD.ts` are large orchestration hooks that centralize too much behavior.
- `TaskDetailPanel.tsx` has a very wide prop surface and bundles many concerns into one scroll-heavy panel.
- Shared primitives are unevenly adopted. `Button.tsx` exists, but many pages still hand-roll actions with one-off class strings.
- The app lacks common field primitives, so forms drift visually and behaviorally.
- The result is maintainable enough for an MVP, but not for a polished, scalable frontend organization.

### Component Refactor Suggestions
- Introduce shared field primitives and a page-level layout vocabulary.
- Split `ProjectDetail.tsx` into clearer zones or route-based subviews.
- Break `TaskDetailPanel.tsx` into collapsible, prioritized sections with stronger information architecture.
- Refactor large hooks toward smaller domain hooks plus a clearer async state model.
- Move repeated settings card patterns into shared settings components.

## Competitive Benchmarking
### Competitive UX Comparison
- Against Linear: below standard. Linear’s strength is focus, keyboard-first speed, clear hierarchy, and exact navigation. TaskToad has more visible feature breadth, but far less workflow discipline.
- Against Notion: below standard. Notion excels at progressive disclosure and flexible, calm information density. TaskToad’s dense workspace and settings surfaces feel more crowded and less intentional.
- Against GitHub Projects: mixed. TaskToad is competitive on built-in AI task generation and integrated planning concepts, but below standard on exact item navigation, saved-view trust, and deep-link reliability.
- Against Jira: mixed. TaskToad is less intimidating and more modern-looking than Jira in some places, but Jira is stronger on structured admin IA, workflow explicitness, and edge-case handling.
- Competitive today: feature breadth for an MVP, AI-assisted flows, decent dashboards, basic keyboard shortcuts, modal focus trapping.
- Below industry standard: search trust, workspace clarity, settings architecture, accessibility rigor, nav discoverability, and consistency of system-level components.
- Exceeding standard: not broadly. The closest area is AI-native planning/automation ambition, but the surrounding UX does not yet support that ambition at a premium-product level.

## Prioritized Improvement Roadmap
1. Fix task deep-linking and unify search. Problem: task search results do not reliably open the selected task. Why it matters: this breaks trust in one of the highest-value workflows. Exact change: make both `GlobalSearchModal.tsx` and `Search.tsx` navigate to a supported deep link, then read and honor that deep link in `useProjectData.ts`/`ProjectDetail.tsx` to open the task panel. Complexity: Low.
2. Simplify the `ProjectDetail.tsx` toolbar. Problem: too many same-weight actions compete in one row. Why it matters: users cannot quickly identify the primary next step. Exact change: keep only view switcher, search, filters, add task, and one overflow actions menu visible; move reports/AI/utilities into grouped menus or side panels. Complexity: Medium.
3. Redesign settings IA. Problem: `OrgSettings.tsx` stacks unrelated admin domains into one narrow page. Why it matters: admins will struggle to form a clean mental model of configuration. Exact change: split into tabs or routes for `Organization`, `Team`, `GitHub`, `Slack`, `Webhooks`, and `Usage`. Complexity: Medium.
4. Replace placeholder-only forms with labeled fields. Problem: auth/onboarding flows rely on placeholders as labels. Why it matters: this harms accessibility, autofill comprehension, and error recovery. Exact change: introduce shared field components and retrofit `Login.tsx`, `Signup.tsx`, `CreateOrg.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, and `AcceptInvite.tsx`. Complexity: Low.
5. Add a real design-system layer. Problem: visual and interaction consistency drift because shared primitives are too shallow. Why it matters: product quality feels uneven, and frontend maintenance cost rises. Exact change: add shared `Input`, `Textarea`, `Select`, `Card`, `Badge`, and `SectionHeader` components, then migrate top-level pages. Complexity: Medium.
6. Make navigation complete and stateful. Problem: `Portfolio` is undiscoverable and main nav has no active state. Why it matters: orientation and discoverability are core SaaS expectations. Exact change: add `Portfolio` to `AppLayout.tsx`, convert to `NavLink`, and add active/selected styling. Complexity: Low.
7. Replace native confirm dialogs. Problem: destructive actions use browser confirms. Why it matters: the experience is abrupt, low-context, and visually inconsistent. Exact change: build one reusable confirmation modal and use it in `ProjectDetail.tsx`, `SlackSettings.tsx`, `WebhookSettings.tsx`, `SprintSection.tsx`, and `useProjectData.ts`. Complexity: Low.
8. Strengthen error and retry UX. Problem: many primary flows silently ignore failures. Why it matters: users are left uncertain whether the system worked. Exact change: add page-level and action-level error states with retry affordances in `Projects.tsx`, `Search.tsx`, `NotificationCenter.tsx`, `useProjectData.ts`, and `useTaskCRUD.ts`. Complexity: Medium.
9. Improve responsive behavior in the workspace. Problem: `AppLayout.tsx` and `ProjectDetail.tsx` rely on fixed widths and dense horizontal controls. Why it matters: smaller laptops and tablet widths will feel cramped or broken. Exact change: add breakpoints for collapsible nav, stacked toolbars, and a drawer-style task panel below desktop widths. Complexity: High.
10. Re-architect the task detail and workspace information hierarchy. Problem: `TaskDetailPanel.tsx` is long and cognitively heavy. Why it matters: frequent daily use will feel slow and exhausting. Exact change: prioritize top sections, add collapsible groups, reduce always-visible metadata, and separate advanced AI/GitHub/automation functions from the default editing path. Complexity: High.

Residual risk: this audit is code-backed rather than based on a live browser walkthrough or user testing, so runtime issues around drag-and-drop, overflow, and focus movement on smaller screens could be worse in practice than they appear in code.
