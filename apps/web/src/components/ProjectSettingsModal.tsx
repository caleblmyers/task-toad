import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import type { OrgUser } from '../types';

interface ProjectMember {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  createdAt: string;
}

interface Props {
  projectId: string;
  orgUsers: OrgUser[];
  onClose: () => void;
}

const TRIGGER_EVENTS = [
  { value: 'task.status_changed', label: 'Status changed' },
  { value: 'task.assigned', label: 'Task assigned' },
];

const ACTION_TYPES = [
  { value: 'notify_assignee', label: 'Notify assignee' },
  { value: 'move_to_column', label: 'Move to column' },
  { value: 'set_status', label: 'Set status' },
  { value: 'assign_to', label: 'Assign to user' },
];

export default function ProjectSettingsModal({ projectId, orgUsers, onClose }: Props) {
  const [tab, setTab] = useState<'members' | 'automation'>('members');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Member form
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('editor');

  // Rule form
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('task.status_changed');
  const [triggerConditionKey, setTriggerConditionKey] = useState('newStatus');
  const [triggerConditionValue, setTriggerConditionValue] = useState('');
  const [actionType, setActionType] = useState('notify_assignee');
  const [actionParam, setActionParam] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersData, rulesData] = await Promise.all([
        gql<{ projectMembers: ProjectMember[] }>(
          `query ProjectMembers($projectId: ID!) { projectMembers(projectId: $projectId) { id userId email role createdAt } }`,
          { projectId },
        ),
        gql<{ automationRules: AutomationRule[] }>(
          `query AutomationRules($projectId: ID!) { automationRules(projectId: $projectId) { id name trigger action enabled createdAt } }`,
          { projectId },
        ),
      ]);
      setMembers(membersData.projectMembers);
      setRules(rulesData.automationRules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addUserId) return;
    setError(null);
    try {
      const { addProjectMember } = await gql<{ addProjectMember: ProjectMember }>(
        `mutation AddMember($projectId: ID!, $userId: ID!, $role: String) {
          addProjectMember(projectId: $projectId, userId: $userId, role: $role) { id userId email role createdAt }
        }`,
        { projectId, userId: addUserId, role: addRole },
      );
      setMembers((prev) => [...prev.filter((m) => m.userId !== addProjectMember.userId), addProjectMember]);
      setAddUserId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setError(null);
    try {
      await gql<{ removeProjectMember: boolean }>(
        `mutation RemoveMember($projectId: ID!, $userId: ID!) { removeProjectMember(projectId: $projectId, userId: $userId) }`,
        { projectId, userId },
      );
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    setError(null);
    try {
      const { updateProjectMemberRole } = await gql<{ updateProjectMemberRole: ProjectMember }>(
        `mutation UpdateRole($projectId: ID!, $userId: ID!, $role: String!) {
          updateProjectMemberRole(projectId: $projectId, userId: $userId, role: $role) { id userId email role createdAt }
        }`,
        { projectId, userId, role },
      );
      setMembers((prev) => prev.map((m) => (m.userId === userId ? updateProjectMemberRole : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const handleCreateRule = async () => {
    if (!ruleName.trim()) return;
    setError(null);
    const trigger: Record<string, unknown> = { event: triggerEvent };
    if (triggerConditionValue.trim()) {
      trigger.condition = { [triggerConditionKey]: triggerConditionValue.trim() };
    }
    const action: Record<string, string> = { type: actionType };
    if (actionType === 'move_to_column') action.column = actionParam;
    else if (actionType === 'set_status') action.status = actionParam;
    else if (actionType === 'assign_to') action.userId = actionParam;

    try {
      const { createAutomationRule } = await gql<{ createAutomationRule: AutomationRule }>(
        `mutation CreateRule($projectId: ID!, $name: String!, $trigger: String!, $action: String!) {
          createAutomationRule(projectId: $projectId, name: $name, trigger: $trigger, action: $action) { id name trigger action enabled createdAt }
        }`,
        { projectId, name: ruleName.trim(), trigger: JSON.stringify(trigger), action: JSON.stringify(action) },
      );
      setRules((prev) => [...prev, createAutomationRule]);
      setRuleName('');
      setTriggerConditionValue('');
      setActionParam('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create rule');
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const { updateAutomationRule } = await gql<{ updateAutomationRule: AutomationRule }>(
        `mutation ToggleRule($ruleId: ID!, $enabled: Boolean) {
          updateAutomationRule(ruleId: $ruleId, enabled: $enabled) { id name trigger action enabled createdAt }
        }`,
        { ruleId, enabled },
      );
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updateAutomationRule : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await gql<{ deleteAutomationRule: boolean }>(
        `mutation DeleteRule($ruleId: ID!) { deleteAutomationRule(ruleId: $ruleId) }`,
        { ruleId },
      );
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete rule');
    }
  };

  const describeTrigger = (triggerJson: string) => {
    try {
      const t = JSON.parse(triggerJson) as { event: string; condition?: Record<string, string> };
      const eventLabel = TRIGGER_EVENTS.find((e) => e.value === t.event)?.label ?? t.event;
      if (t.condition) {
        const conds = Object.entries(t.condition).map(([k, v]) => `${k} = ${v}`).join(', ');
        return `${eventLabel} (${conds})`;
      }
      return eventLabel;
    } catch {
      return triggerJson;
    }
  };

  const describeAction = (actionJson: string) => {
    try {
      const a = JSON.parse(actionJson) as { type: string; column?: string; status?: string; userId?: string };
      const label = ACTION_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
      if (a.column) return `${label}: ${a.column}`;
      if (a.status) return `${label}: ${a.status}`;
      if (a.userId) {
        const user = orgUsers.find((u) => u.userId === a.userId);
        return `${label}: ${user?.email ?? a.userId}`;
      }
      return label;
    } catch {
      return actionJson;
    }
  };

  // Filter out users who are already members
  const availableUsers = orgUsers.filter((u) => !members.some((m) => m.userId === u.userId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Project Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4">
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'members' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setTab('members')}
          >
            Members
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'automation' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setTab('automation')}
          >
            Automation
          </button>
        </div>

        {error && <p className="text-sm text-red-600 px-4 pt-2">{error}</p>}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : tab === 'members' ? (
            <>
              {/* Members list */}
              <ul className="divide-y divide-slate-100">
                {members.map((m) => (
                  <li key={m.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="text-slate-800">{m.email}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) => handleUpdateRole(m.userId, e.target.value)}
                        className="text-xs border border-slate-300 rounded px-1.5 py-0.5"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={() => handleRemoveMember(m.userId)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                    </div>
                  </li>
                ))}
                {members.length === 0 && <li className="py-2 text-sm text-slate-500">No project members yet.</li>}
              </ul>

              {/* Add member */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Add member</p>
                <div className="flex items-center gap-2">
                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5"
                  >
                    <option value="">Select user...</option>
                    {availableUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>{u.email}</option>
                    ))}
                  </select>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="text-sm border border-slate-300 rounded px-2 py-1.5"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handleAddMember}
                    disabled={!addUserId}
                    className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded hover:bg-slate-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Rules list */}
              <ul className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <li key={r.id} className="py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{r.name}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={r.enabled}
                            onChange={(e) => handleToggleRule(r.id, e.target.checked)}
                            className="rounded"
                          />
                          Enabled
                        </label>
                        <button onClick={() => handleDeleteRule(r.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      When: {describeTrigger(r.trigger)} → Then: {describeAction(r.action)}
                    </p>
                  </li>
                ))}
                {rules.length === 0 && <li className="py-2 text-sm text-slate-500">No automation rules yet.</li>}
              </ul>

              {/* Add rule form */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Add rule</p>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Rule name"
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">When:</label>
                  <select
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
                  >
                    {TRIGGER_EVENTS.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Condition:</label>
                  <input
                    type="text"
                    value={triggerConditionKey}
                    onChange={(e) => setTriggerConditionKey(e.target.value)}
                    placeholder="key"
                    className="w-24 text-sm border border-slate-300 rounded px-2 py-1"
                  />
                  <span className="text-xs text-slate-400">=</span>
                  <input
                    type="text"
                    value={triggerConditionValue}
                    onChange={(e) => setTriggerConditionValue(e.target.value)}
                    placeholder="value (optional)"
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Then:</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
                  >
                    {ACTION_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                {actionType !== 'notify_assignee' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">
                      {actionType === 'move_to_column' ? 'Column:' : actionType === 'set_status' ? 'Status:' : 'User:'}
                    </label>
                    {actionType === 'assign_to' ? (
                      <select
                        value={actionParam}
                        onChange={(e) => setActionParam(e.target.value)}
                        className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
                      >
                        <option value="">Select user...</option>
                        {orgUsers.map((u) => (
                          <option key={u.userId} value={u.userId}>{u.email}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={actionParam}
                        onChange={(e) => setActionParam(e.target.value)}
                        placeholder={actionType === 'move_to_column' ? 'Column name' : 'Status slug'}
                        className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
                      />
                    )}
                  </div>
                )}
                <button
                  onClick={handleCreateRule}
                  disabled={!ruleName.trim()}
                  className="px-3 py-1.5 bg-slate-800 text-white text-sm rounded hover:bg-slate-700 disabled:opacity-50"
                >
                  Create Rule
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
