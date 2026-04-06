import { useState, useCallback } from 'react';
import Modal from './shared/Modal';
import Button from './shared/Button';
import { IconSparkle } from './shared/Icons';
import { gql } from '../api/client';
import { TASK_FIELDS } from '../utils/taskHelpers';
import { CREATE_TASK_MUTATION, GENERATE_INSTRUCTIONS_MUTATION } from '../api/queries';
import type { Task } from '../types';

interface CreateTaskModalProps {
  projectId: string;
  onCreated: (task: Task) => void;
  onClose: () => void;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const TASK_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'epic', label: 'Epic' },
  { value: 'story', label: 'Story' },
];

// Extended create mutation that returns full task fields for AI enhancement
const CREATE_TASK_FULL_MUTATION = `mutation CreateTask($projectId: ID!, $title: String!, $taskType: String) {
  createTask(projectId: $projectId, title: $title, taskType: $taskType) { ${TASK_FIELDS} }
}`;

// Update mutation for saving edited AI-generated fields
const UPDATE_TASK_FIELDS_MUTATION = `mutation UpdateTask($taskId: ID!, $description: String, $priority: String, $instructions: String, $acceptanceCriteria: String, $storyPoints: Int) {
  updateTask(taskId: $taskId, description: $description, priority: $priority, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, storyPoints: $storyPoints) { task { taskId } warnings }
}`;

export default function CreateTaskModal({ projectId, onCreated, onClose }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [taskType, setTaskType] = useState('task');

  // AI enhancement state
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiAcceptanceCriteria, setAiAcceptanceCriteria] = useState('');
  const [aiStoryPoints, setAiStoryPoints] = useState<number | ''>('');

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await gql<{ createTask: Task }>(CREATE_TASK_MUTATION, { projectId, title: title.trim() });
      onCreated({} as Task);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }, [projectId, title, onCreated, onClose]);

  const handleEnhance = useCallback(async () => {
    if (!title.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      // Create the task first
      const createData = await gql<{ createTask: Task }>(CREATE_TASK_FULL_MUTATION, {
        projectId,
        title: title.trim(),
        taskType: taskType !== 'task' ? taskType : undefined,
      });
      const task = createData.createTask;
      setCreatedTask(task);

      // If description was provided, save it before generating instructions
      if (description.trim()) {
        await gql(UPDATE_TASK_FIELDS_MUTATION, {
          taskId: task.taskId,
          description: description.trim(),
          priority,
        });
      } else if (priority !== 'medium') {
        await gql(UPDATE_TASK_FIELDS_MUTATION, {
          taskId: task.taskId,
          priority,
        });
      }

      // Generate AI instructions
      const aiData = await gql<{ generateTaskInstructions: Task }>(
        GENERATE_INSTRUCTIONS_MUTATION,
        { taskId: task.taskId },
      );
      const enhanced = aiData.generateTaskInstructions;
      setAiInstructions(enhanced.instructions || '');
      setAiAcceptanceCriteria(enhanced.acceptanceCriteria || '');
      setAiStoryPoints(enhanced.storyPoints ?? '');
      setEnhanced(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance task');
    } finally {
      setEnhancing(false);
    }
  }, [projectId, title, description, priority, taskType]);

  const handleSaveEnhanced = useCallback(async () => {
    if (!createdTask) return;
    setCreating(true);
    setError(null);
    try {
      await gql(UPDATE_TASK_FIELDS_MUTATION, {
        taskId: createdTask.taskId,
        description: description.trim() || undefined,
        priority,
        instructions: aiInstructions || undefined,
        acceptanceCriteria: aiAcceptanceCriteria || undefined,
        storyPoints: aiStoryPoints !== '' ? Number(aiStoryPoints) : undefined,
      });
      onCreated(createdTask);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setCreating(false);
    }
  }, [createdTask, description, priority, aiInstructions, aiAcceptanceCriteria, aiStoryPoints, onCreated, onClose]);

  return (
    <Modal isOpen onClose={onClose} title="Create Task" size="lg" variant="top-aligned">
      <div className="p-6 space-y-5 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {enhanced ? 'Review Task' : 'Create Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="create-task-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            What needs to be done? <span className="text-red-500">*</span>
          </label>
          <input
            id="create-task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Add user authentication flow"
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green dark:bg-slate-700 dark:text-slate-200"
            autoFocus
            disabled={enhanced || enhancing}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="create-task-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description <span className="text-slate-400 text-xs font-normal">(optional)</span>
          </label>
          <textarea
            id="create-task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task in more detail..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green dark:bg-slate-700 dark:text-slate-200 resize-none"
            disabled={enhanced || enhancing}
          />
        </div>

        {/* Type + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="create-task-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
            <select
              id="create-task-type"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green dark:bg-slate-700 dark:text-slate-200"
              disabled={enhanced || enhancing}
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-task-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
            <select
              id="create-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green dark:bg-slate-700 dark:text-slate-200"
              disabled={enhanced || enhancing}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* AI-enhanced fields (shown after enhancement) */}
        {enhanced && (
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
              <IconSparkle className="w-4 h-4" />
              AI-Generated Details
            </div>

            <div>
              <label htmlFor="ai-instructions" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Instructions
              </label>
              <textarea
                id="ai-instructions"
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-200 resize-none"
              />
            </div>

            <div>
              <label htmlFor="ai-acceptance" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Acceptance Criteria
              </label>
              <textarea
                id="ai-acceptance"
                value={aiAcceptanceCriteria}
                onChange={(e) => setAiAcceptanceCriteria(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-200 resize-none"
              />
            </div>

            <div className="max-w-[160px]">
              <label htmlFor="ai-points" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Story Points
              </label>
              <input
                id="ai-points"
                type="number"
                min={0}
                value={aiStoryPoints}
                onChange={(e) => setAiStoryPoints(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
          </div>
        )}

        {/* Enhancing loading state */}
        {enhancing && (
          <div className="flex items-center gap-3 py-4 px-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 dark:border-indigo-400" />
            <span className="text-sm text-indigo-700 dark:text-indigo-300">Generating instructions...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          {!enhanced && !enhancing && (
            <>
              <Button
                variant="secondary"
                size="md"
                onClick={handleCreate}
                loading={creating}
                disabled={!title.trim() || creating}
              >
                Create
              </Button>
              <button
                type="button"
                onClick={handleEnhance}
                disabled={!title.trim() || enhancing}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <IconSparkle className="w-4 h-4" />
                Enhance with AI
              </button>
            </>
          )}

          {enhanced && (
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveEnhanced}
              loading={creating}
              disabled={creating}
            >
              Done
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
