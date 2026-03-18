import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import Button from '../shared/Button';

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
}

export default function TemplatesTab({ projectId }: Props) {
  const [templates, setTemplates] = useState<TaskTemplateDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplateDef | null>(null);

  // Create form
  const [tplName, setTplName] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const [tplInstructions, setTplInstructions] = useState('');
  const [tplAcceptanceCriteria, setTplAcceptanceCriteria] = useState('');
  const [tplEstimatedHours, setTplEstimatedHours] = useState('');
  const [tplStoryPoints, setTplStoryPoints] = useState('');
  const [tplPriority, setTplPriority] = useState('medium');
  const [tplTaskType, setTplTaskType] = useState('task');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gql<{ taskTemplates: TaskTemplateDef[] }>(
        `query TaskTemplates($projectId: ID) { taskTemplates(projectId: $projectId) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt } }`,
        { projectId },
      );
      setTemplates(data.taskTemplates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

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

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>;

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {editingTemplate ? (
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
      )}
    </>
  );
}
