# V1 Feature Cuts

Features hidden from the frontend for V1 launch. Backend code remains intact and functional.
To re-enable any feature, restore the removed code in the files listed below.

Hidden in Wave 53 (2026-03-22).

---

## 1. Initiatives (Portfolio Page)

**What was hidden:** Initiative cards, create/edit modals, project-to-initiative linking, initiative-based project filtering on the Portfolio page.

**Files modified:**
- `apps/web/src/pages/Portfolio.tsx`

**What was removed:**
- Imports: `INITIATIVES_QUERY`, `CREATE_INITIATIVE_MUTATION`, `UPDATE_INITIATIVE_MUTATION`, `DELETE_INITIATIVE_MUTATION`, `ADD_PROJECT_TO_INITIATIVE_MUTATION`, `REMOVE_PROJECT_FROM_INITIATIVE_MUTATION`, `INITIATIVE_SUMMARY_QUERY`
- Interfaces: `InitiativeProject`, `Initiative`, `InitiativeSummaryData`
- Components: `CreateInitiativeModal`, `EditInitiativeModal`, `AddProjectDropdown`, `InitiativeCard`
- State: `showCreateModal`, `editingInitiative`, `selectedInitiativeId`
- Data fetching: initiatives and summaries fetched in `useAsyncData`
- JSX: Initiatives section with cards grid, initiative filter indicator, modal renders
- `PortfolioData` interface trimmed to remove `initiatives` and `summaries` fields

**How to re-enable:** Restore the initiative imports, interfaces, components, state variables, data fetching logic, and JSX sections. Reference git history for the full code (`git show HEAD~1:apps/web/src/pages/Portfolio.tsx`).

---

## 2. SLA Tracking

**What was hidden:** SLA status badge on task detail, SLA policy management tab in project settings.

**Files modified:**
- `apps/web/src/components/TaskDetailPanel.tsx`
- `apps/web/src/components/ProjectSettingsModal.tsx`

**What was removed:**
- `TaskDetailPanel.tsx`: Import and render of `SLAStatusBadge` component (was displayed next to task title)
- `ProjectSettingsModal.tsx`: Import of `SLATab`, 'sla' entry in `TABS` array, `SLATab` render in tab content

**How to re-enable:**
1. In `TaskDetailPanel.tsx`, add `import SLAStatusBadge from './taskdetail/SLAStatusBadge';` and render `<SLAStatusBadge taskId={task.taskId} />` next to the task title div
2. In `ProjectSettingsModal.tsx`, add `import SLATab from './settings/SLATab';`, add `'sla'` to the `Tab` type, add `{ key: 'sla', label: 'SLA' }` to `TABS`, and add `{tab === 'sla' && <SLATab projectId={projectId} />}` to the tab content area

---

## 3. Approval Workflows

**What was hidden:** Approval badge in task detail, pending approvals panel, approval column in workflow settings, approvals menu item in project toolbar.

**Files modified:**
- `apps/web/src/components/TaskDetailPanel.tsx`
- `apps/web/src/components/settings/WorkflowTab.tsx`
- `apps/web/src/components/ProjectToolbar.tsx`
- `apps/web/src/pages/ProjectDetail.tsx`

**What was removed:**
- `TaskDetailPanel.tsx`: Import and render of `ApprovalBadge` component
- `WorkflowTab.tsx`: `TransitionCondition` interface, `parseCondition` function, `handleConditionUpdate` and `handleApproverToggle` callbacks, "Approval" table column header, approval checkbox/approver picker `<td>` cell, `orgUsers` prop (no longer needed)
- `ProjectToolbar.tsx`: "Approvals" item from overflow dropdown menu
- `ProjectDetail.tsx`: Lazy import of `PendingApprovalsPanel`, approvals modal render block

**How to re-enable:**
1. Restore `ApprovalBadge` import/render in `TaskDetailPanel.tsx`
2. Restore `TransitionCondition` interface, `parseCondition`, `handleConditionUpdate`, `handleApproverToggle` in `WorkflowTab.tsx`; re-add the "Approval" column header and `<td>` cell; re-add `orgUsers` prop
3. Re-add `{ label: 'Approvals', onClick: () => onOpenModal('approvals') }` to toolbar overflow menu
4. Re-add `PendingApprovalsPanel` lazy import and modal render in `ProjectDetail.tsx`

---

## 4. Scheduled Automations (Cron Triggers)

**What was hidden:** "Scheduled (cron)" trigger type option, cron expression input, preset buttons, and timezone selector in automation rule builder.

**Files modified:**
- `apps/web/src/components/settings/AutomationTab.tsx`

**What was removed:**
- `{ value: 'scheduled', label: 'Scheduled (cron)' }` from `TRIGGER_EVENTS` array
- `cronExpression` and `timezone` state variables
- Cron expression/timezone variables in `handleCreateRule` mutation call
- State resets for `cronExpression`/`timezone` in form reset logic
- Entire schedule UI block (cron presets, cron input, timezone selector)

**How to re-enable:** Add 'scheduled' back to `TRIGGER_EVENTS`, restore `cronExpression`/`timezone` state, restore the cron logic in `handleCreateRule`, and restore the schedule UI block (rendered when `triggerEvent === 'scheduled'`).

---

## 5. BacklogView Keyboard Navigation

**What was hidden:** Arrow key navigation between task rows in the backlog list, ARIA listbox/option roles.

**Files modified:**
- `apps/web/src/components/BacklogView.tsx`

**What was removed:**
- `handleListKeyDown` callback (ArrowUp/ArrowDown navigation)
- `role="listbox"` from container div
- `onKeyDown={handleListKeyDown}` from container div
- `role="option"` and `aria-selected` attributes from task row divs (both virtualized and non-virtualized)
- `KeyboardEvent` type import

**How to re-enable:** Restore the `handleListKeyDown` callback, add `role="listbox"` and `onKeyDown` back to the container, and add `role="option"` + `aria-selected` to task row divs. Click-to-open behavior is unchanged.
