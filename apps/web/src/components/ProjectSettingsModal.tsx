import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { parseOptions } from '../utils/jsonHelpers';
import type { OrgUser } from '../types';
import Modal from './shared/Modal';
import Button from './shared/Button';

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

interface CustomFieldDef {
  customFieldId: string;
  name: string;
  fieldType: string;
  options: string | null;
  required: boolean;
  position: number;
}

interface TaskTemplateDef {
  taskTemplateId: string;
  name: string;
  description: string | null;
  instructions: string | null;
  acceptanceCriteria: string | null;
  priority: string;
  taskType: string;
  estimatedHours: number | null;
  storyPoints: number | null;
  projectId: string | null;
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
  const [tab, setTab] = useState<'members' | 'automation' | 'fields' | 'templates'>('members');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Member form
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('editor');

  // Custom field form
  const [cfName, setCfName] = useState('');
  const [cfType, setCfType] = useState('TEXT');
  const [cfOptions, setCfOptions] = useState('');
  const [cfRequired, setCfRequired] = useState(false);

  // Template form
  const [tplName, setTplName] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const [tplInstructions, setTplInstructions] = useState('');
  const [tplAcceptanceCriteria, setTplAcceptanceCriteria] = useState('');
  const [tplEstimatedHours, setTplEstimatedHours] = useState('');
  const [tplStoryPoints, setTplStoryPoints] = useState('');
  const [tplPriority, setTplPriority] = useState('medium');
  const [tplTaskType, setTplTaskType] = useState('task');
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplateDef | null>(null);

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
      const [membersData, rulesData, fieldsData, templatesData] = await Promise.all([
        gql<{ projectMembers: ProjectMember[] }>(
          `query ProjectMembers($projectId: ID!) { projectMembers(projectId: $projectId) { id userId email role createdAt } }`,
          { projectId },
        ),
        gql<{ automationRules: AutomationRule[] }>(
          `query AutomationRules($projectId: ID!) { automationRules(projectId: $projectId) { id name trigger action enabled createdAt } }`,
          { projectId },
        ),
        gql<{ customFields: CustomFieldDef[] }>(
          `query CustomFields($projectId: ID!) { customFields(projectId: $projectId) { customFieldId name fieldType options required position } }`,
          { projectId },
        ),
        gql<{ taskTemplates: TaskTemplateDef[] }>(
          `query TaskTemplates($projectId: ID) { taskTemplates(projectId: $projectId) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt } }`,
          { projectId },
        ),
      ]);
      setMembers(membersData.projectMembers);
      setRules(rulesData.automationRules);
      setCustomFields(fieldsData.customFields);
      setTemplates(templatesData.taskTemplates);
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

  const handleCreateCustomField = async () => {
    if (!cfName.trim()) return;
    setError(null);
    try {
      const { createCustomField } = await gql<{ createCustomField: CustomFieldDef }>(
        `mutation CreateCF($projectId: ID!, $name: String!, $fieldType: String!, $options: String, $required: Boolean) {
          createCustomField(projectId: $projectId, name: $name, fieldType: $fieldType, options: $options, required: $required) { customFieldId name fieldType options required position }
        }`,
        {
          projectId,
          name: cfName.trim(),
          fieldType: cfType,
          options: cfType === 'DROPDOWN' && cfOptions.trim() ? JSON.stringify(cfOptions.split(',').map((s) => s.trim()).filter(Boolean)) : null,
          required: cfRequired,
        },
      );
      setCustomFields((prev) => [...prev, createCustomField]);
      setCfName('');
      setCfOptions('');
      setCfRequired(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create custom field');
    }
  };

  const handleDeleteCustomField = async (fieldId: string) => {
    try {
      await gql<{ deleteCustomField: boolean }>(
        `mutation DeleteCF($customFieldId: ID!) { deleteCustomField(customFieldId: $customFieldId) }`,
        { customFieldId: fieldId },
      );
      setCustomFields((prev) => prev.filter((f) => f.customFieldId !== fieldId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete custom field');
    }
  };

  const handleCreateTemplate = async () => {
    if (!tplName.trim()) return;
    setError(null);
    try {
      const { createTaskTemplate } = await gql<{ createTaskTemplate: TaskTemplateDef }>(
        `mutation CreateTemplate($projectId: ID, $name: String!, $description: String, $instructions: String, $acceptanceCriteria: String, $estimatedHours: Float, $storyPoints: Int, $priority: String, $taskType: String) {
          createTaskTemplate(projectId: $projectId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, estimatedHours: $estimatedHours, storyPoints: $storyPoints, priority: $priority, taskType: $taskType) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt }
        }`,
        {
          projectId,
          name: tplName.trim(),
          description: tplDescription.trim() || null,
          instructions: tplInstructions.trim() || null,
          acceptanceCriteria: tplAcceptanceCriteria.trim() || null,
          estimatedHours: tplEstimatedHours ? parseFloat(tplEstimatedHours) : null,
          storyPoints: tplStoryPoints ? parseInt(tplStoryPoints, 10) : null,
          priority: tplPriority,
          taskType: tplTaskType,
        },
      );
      setTemplates((prev) => [createTaskTemplate, ...prev]);
      setTplName('');
      setTplDescription('');
      setTplInstructions('');
      setTplAcceptanceCriteria('');
      setTplEstimatedHours('');
      setTplStoryPoints('');
      setTplPriority('medium');
      setTplTaskType('task');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create template');
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    setError(null);
    try {
      const { updateTaskTemplate } = await gql<{ updateTaskTemplate: TaskTemplateDef }>(
        `mutation UpdateTemplate($taskTemplateId: ID!, $name: String, $description: String, $instructions: String, $acceptanceCriteria: String, $estimatedHours: Float, $storyPoints: Int, $priority: String, $taskType: String) {
          updateTaskTemplate(taskTemplateId: $taskTemplateId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, estimatedHours: $estimatedHours, storyPoints: $storyPoints, priority: $priority, taskType: $taskType) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt }
        }`,
        {
          taskTemplateId: editingTemplate.taskTemplateId,
          name: editingTemplate.name,
          description: editingTemplate.description,
          instructions: editingTemplate.instructions,
          acceptanceCriteria: editingTemplate.acceptanceCriteria,
          estimatedHours: editingTemplate.estimatedHours,
          storyPoints: editingTemplate.storyPoints,
          priority: editingTemplate.priority,
          taskType: editingTemplate.taskType,
        },
      );
      setTemplates((prev) => prev.map((t) => (t.taskTemplateId === updateTaskTemplate.taskTemplateId ? updateTaskTemplate : t)));
      setEditingTemplate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    setError(null);
    try {
      await gql<{ deleteTaskTemplate: boolean }>(
        `mutation DeleteTemplate($taskTemplateId: ID!) { deleteTaskTemplate(taskTemplateId: $taskTemplateId) }`,
        { taskTemplateId: templateId },
      );
      setTemplates((prev) => prev.filter((t) => t.taskTemplateId !== templateId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    }
  };

  const handleReorderField = async (fieldId: string, direction: 'up' | 'down') => {
    const sorted = [...customFields].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((f) => f.customFieldId === fieldId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const fieldA = sorted[idx];
    const fieldB = sorted[swapIdx];
    setError(null);
    try {
      await Promise.all([
        gql<{ updateCustomField: CustomFieldDef }>(
          `mutation ReorderA($customFieldId: ID!, $position: Int) { updateCustomField(customFieldId: $customFieldId, position: $position) { customFieldId name fieldType options required position } }`,
          { customFieldId: fieldA.customFieldId, position: fieldB.position },
        ),
        gql<{ updateCustomField: CustomFieldDef }>(
          `mutation ReorderB($customFieldId: ID!, $position: Int) { updateCustomField(customFieldId: $customFieldId, position: $position) { customFieldId name fieldType options required position } }`,
          { customFieldId: fieldB.customFieldId, position: fieldA.position },
        ),
      ]);
      setCustomFields((prev) =>
        prev.map((f) => {
          if (f.customFieldId === fieldA.customFieldId) return { ...f, position: fieldB.position };
          if (f.customFieldId === fieldB.customFieldId) return { ...f, position: fieldA.position };
          return f;
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder fields');
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
    <Modal isOpen={true} onClose={onClose} title="Project Settings" size="md">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-600">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Project Settings</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none" aria-label="Close">&times;</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-600 px-4">
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'members' ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setTab('members')}
        >
          Members
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'automation' ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setTab('automation')}
        >
          Automation
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'fields' ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setTab('fields')}
        >
          Custom Fields
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'templates' ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setTab('templates')}
        >
          Templates
        </button>
      </div>

      {error && <p className="text-sm text-red-600 px-4 pt-2">{error}</p>}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
        ) : tab === 'templates' ? (
          editingTemplate ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Edit Template</p>
                <button onClick={() => setEditingTemplate(null)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700">Cancel</button>
              </div>
              <input
                type="text"
                value={editingTemplate.name}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                placeholder="Template name"
                className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
              />
              <textarea
                value={editingTemplate.description ?? ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value || null })}
                placeholder="Description"
                className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 h-20 resize-none"
              />
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Instructions</label>
                <textarea
                  value={editingTemplate.instructions ?? ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, instructions: e.target.value || null })}
                  placeholder="Implementation details..."
                  rows={4}
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Acceptance Criteria</label>
                <textarea
                  value={editingTemplate.acceptanceCriteria ?? ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, acceptanceCriteria: e.target.value || null })}
                  placeholder="How to verify this task is done..."
                  rows={3}
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Priority:</label>
                <select
                  value={editingTemplate.priority}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, priority: e.target.value })}
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Type:</label>
                <select
                  value={editingTemplate.taskType}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, taskType: e.target.value })}
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                  <option value="feature">Feature</option>
                  <option value="chore">Chore</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Est. Hours:</label>
                  <input
                    type="number"
                    value={editingTemplate.estimatedHours ?? ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, estimatedHours: e.target.value ? parseFloat(e.target.value) : null })}
                    min={0}
                    step={0.5}
                    className="w-20 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Story Pts:</label>
                  <input
                    type="number"
                    value={editingTemplate.storyPoints ?? ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, storyPoints: e.target.value ? parseInt(e.target.value, 10) : null })}
                    min={0}
                    step={1}
                    className="w-20 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                  />
                </div>
              </div>
              <Button size="sm" disabled={!editingTemplate.name.trim()} onClick={handleUpdateTemplate}>
                Save Changes
              </Button>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {templates.map((t) => (
                  <li key={t.taskTemplateId} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{t.priority} / {t.taskType}</span>
                      {!t.projectId && <span className="ml-1 text-xs text-blue-400">org-wide</span>}
                      {t.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingTemplate(t)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 text-xs">Edit</button>
                      <button onClick={() => handleDeleteTemplate(t.taskTemplateId)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                    </div>
                  </li>
                ))}
                {templates.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No templates yet.</li>}
              </ul>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Create template</p>
                <input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Template name"
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
                />
                <textarea
                  value={tplDescription}
                  onChange={(e) => setTplDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 h-16 resize-none"
                />
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Instructions</label>
                  <textarea
                    value={tplInstructions}
                    onChange={(e) => setTplInstructions(e.target.value)}
                    placeholder="Implementation details..."
                    rows={4}
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Acceptance Criteria</label>
                  <textarea
                    value={tplAcceptanceCriteria}
                    onChange={(e) => setTplAcceptanceCriteria(e.target.value)}
                    placeholder="How to verify this task is done..."
                    rows={3}
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Priority:</label>
                  <select
                    value={tplPriority}
                    onChange={(e) => setTplPriority(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Type:</label>
                  <select
                    value={tplTaskType}
                    onChange={(e) => setTplTaskType(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                  >
                    <option value="task">Task</option>
                    <option value="bug">Bug</option>
                    <option value="feature">Feature</option>
                    <option value="chore">Chore</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400">Est. Hours:</label>
                    <input
                      type="number"
                      value={tplEstimatedHours}
                      onChange={(e) => setTplEstimatedHours(e.target.value)}
                      min={0}
                      step={0.5}
                      className="w-20 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400">Story Pts:</label>
                    <input
                      type="number"
                      value={tplStoryPoints}
                      onChange={(e) => setTplStoryPoints(e.target.value)}
                      min={0}
                      step={1}
                      className="w-20 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                    />
                  </div>
                </div>
                <Button size="sm" disabled={!tplName.trim()} onClick={handleCreateTemplate}>
                  Create Template
                </Button>
              </div>
            </>
          )
        ) : tab === 'fields' ? (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {[...customFields].sort((a, b) => a.position - b.position).map((f, idx) => (
                <li key={f.customFieldId} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleReorderField(f.customFieldId, 'up')}
                        disabled={idx === 0}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed text-xs leading-none"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleReorderField(f.customFieldId, 'down')}
                        disabled={idx === customFields.length - 1}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed text-xs leading-none"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{f.fieldType}</span>
                      {f.required && <span className="ml-1 text-xs text-red-400">required</span>}
                      {f.options && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Options: {parseOptions(f.options).join(', ') || f.options}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteCustomField(f.customFieldId)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </li>
              ))}
              {customFields.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No custom fields yet.</li>}
            </ul>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add custom field</p>
              <input
                type="text"
                value={cfName}
                onChange={(e) => setCfName(e.target.value)}
                placeholder="Field name"
                className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Type:</label>
                <select
                  value={cfType}
                  onChange={(e) => setCfType(e.target.value)}
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                >
                  <option value="TEXT">Text</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="DROPDOWN">Dropdown</option>
                </select>
              </div>
              {cfType === 'DROPDOWN' && (
                <input
                  type="text"
                  value={cfOptions}
                  onChange={(e) => setCfOptions(e.target.value)}
                  placeholder="Options (comma-separated)"
                  className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
                />
              )}
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={cfRequired}
                  onChange={(e) => setCfRequired(e.target.checked)}
                  className="rounded"
                />
                Required field
              </label>
              <Button size="sm" disabled={!cfName.trim()} onClick={handleCreateCustomField}>
                Create Field
              </Button>
            </div>
          </>
        ) : tab === 'members' ? (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {members.map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-slate-800">{m.email}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => handleUpdateRole(m.userId, e.target.value)}
                      className="text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-1.5 py-0.5"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => handleRemoveMember(m.userId)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                  </div>
                </li>
              ))}
              {members.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No project members yet.</li>}
            </ul>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add member</p>
              <div className="flex items-center gap-2">
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
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
                <Button size="sm" disabled={!addUserId} onClick={handleAddMember}>
                  Add
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {rules.map((r) => (
                <li key={r.id} className="py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.name}</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    When: {describeTrigger(r.trigger)} → Then: {describeAction(r.action)}
                  </p>
                </li>
              ))}
              {rules.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No automation rules yet.</li>}
            </ul>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add rule</p>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Rule name"
                className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">When:</label>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                >
                  {TRIGGER_EVENTS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Condition:</label>
                <input
                  type="text"
                  value={triggerConditionKey}
                  onChange={(e) => setTriggerConditionKey(e.target.value)}
                  placeholder="key"
                  className="w-24 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                />
                <span className="text-xs text-slate-400">=</span>
                <input
                  type="text"
                  value={triggerConditionValue}
                  onChange={(e) => setTriggerConditionValue(e.target.value)}
                  placeholder="value (optional)"
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Then:</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              {actionType !== 'notify_assignee' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    {actionType === 'move_to_column' ? 'Column:' : actionType === 'set_status' ? 'Status:' : 'User:'}
                  </label>
                  {actionType === 'assign_to' ? (
                    <select
                      value={actionParam}
                      onChange={(e) => setActionParam(e.target.value)}
                      className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
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
                      className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
                    />
                  )}
                </div>
              )}
              <Button size="sm" disabled={!ruleName.trim()} onClick={handleCreateRule}>
                Create Rule
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
