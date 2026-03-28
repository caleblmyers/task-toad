import { useState, useEffect, useRef } from 'react';
import { gql } from '../api/client';
import {
  PREVIEW_HIERARCHICAL_PLAN_QUERY,
  COMMIT_HIERARCHICAL_PLAN_MUTATION,
} from '../api/queries';
import type { Task } from '../types';
import Modal from './shared/Modal';
import Button from './shared/Button';
import { IconClose } from './shared/Icons';
import {
  HierarchicalPlanEditor,
  type HierarchicalPlanPreview,
} from './HierarchicalPlanEditor';

interface HierarchicalPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onPlanCommitted: () => void;
}

type DialogState = 'prompt' | 'editing' | 'committing';

export default function HierarchicalPlanDialog({
  isOpen,
  onClose,
  projectId,
  onPlanCommitted,
}: HierarchicalPlanDialogProps) {
  const [state, setState] = useState<DialogState>('prompt');
  const [prompt, setPrompt] = useState('');
  const [feedback, setFeedback] = useState('');
  const [plan, setPlan] = useState<HierarchicalPlanPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleGenerate = async () => {
    const text = state === 'prompt' ? prompt : `${prompt}\n\nFeedback: ${feedback}`;
    if (!text.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await gql<{
        previewHierarchicalPlan: HierarchicalPlanPreview;
      }>(PREVIEW_HIERARCHICAL_PLAN_QUERY, {
        projectId,
        prompt: text.trim(),
      });
      setPlan(data.previewHierarchicalPlan);
      setState('editing');
      setFeedback('');
      setShowFeedback(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate plan',
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCommit = async () => {
    if (!plan) return;
    setState('committing');
    setCommitting(true);
    setError(null);
    try {
      // Strip null fields and prepare input for mutation
      const epics = plan.epics.map((epic) => ({
        title: epic.title,
        description: epic.description,
        instructions: epic.instructions,
        estimatedHours: epic.estimatedHours,
        priority: epic.priority,
        acceptanceCriteria: epic.acceptanceCriteria,
        autoComplete: epic.autoComplete,
        dependsOn: epic.dependsOn?.map((d) => ({
          title: d.title,
          linkType: d.linkType,
        })),
        tasks: epic.tasks?.map((task) => ({
          title: task.title,
          description: task.description,
          instructions: task.instructions,
          estimatedHours: task.estimatedHours,
          priority: task.priority,
          acceptanceCriteria: task.acceptanceCriteria,
          autoComplete: task.autoComplete,
          dependsOn: task.dependsOn?.map((d) => ({
            title: d.title,
            linkType: d.linkType,
          })),
          subtasks: task.subtasks?.map((st) => ({
            title: st.title,
            description: st.description,
            estimatedHours: st.estimatedHours,
            priority: st.priority,
            acceptanceCriteria: st.acceptanceCriteria,
          })),
        })),
      }));

      await gql<{ commitHierarchicalPlan: Task[] }>(
        COMMIT_HIERARCHICAL_PLAN_MUTATION,
        { projectId, epics, clearExisting: false },
      );
      onPlanCommitted();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to commit plan',
      );
      setState('editing');
    } finally {
      setCommitting(false);
    }
  };

  const handleRegenerate = () => {
    setShowFeedback(true);
  };

  const loading = generating || committing;

  // Time-based progress messages during generation
  const PROGRESS_MESSAGES = [
    'Analyzing project scope...',
    'Generating epics...',
    'Planning tasks and subtasks...',
    'Finalizing dependency graph...',
  ];
  const [progressIndex, setProgressIndex] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (generating) {
      setProgressIndex(0);
      progressTimerRef.current = setInterval(() => {
        setProgressIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1));
      }, 3000);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  // Count totals for summary
  const totalEpics = plan?.epics.length ?? 0;
  const totalTasks = plan?.epics.reduce((s, e) => s + (e.tasks?.length ?? 0), 0) ?? 0;
  const totalSubtasks =
    plan?.epics.reduce(
      (s, e) =>
        s +
        (e.tasks?.reduce((ts, t) => ts + (t.subtasks?.length ?? 0), 0) ??
          0),
      0,
    ) ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hierarchical Plan"
      size="xl"
      variant="top-aligned"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          Hierarchical Plan
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label="Close"
        >
          <IconClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {state === 'prompt' && !generating && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Describe your project or feature. The AI will generate a
              hierarchical plan with epics, tasks, and subtasks.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your project, feature, or goals..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-brand-green"
              disabled={loading}
              autoFocus
            />
          </>
        )}

        {generating && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 text-center">
              {PROGRESS_MESSAGES[progressIndex]}
            </p>
            {/* Skeleton epic cards */}
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3"
                style={{ opacity: 1 - i * 0.15 }}
              >
                <div className="flex items-center gap-2">
                  <div className="animate-pulse rounded bg-slate-200 dark:bg-slate-700 h-5 w-40" />
                  <div className="animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 h-5 w-14" />
                </div>
                <div className="animate-pulse rounded bg-slate-200 dark:bg-slate-700 h-3 w-3/4" />
                <div className="pl-4 space-y-2">
                  {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="animate-pulse rounded bg-slate-100 dark:bg-slate-600 h-3 w-3" />
                      <div className="animate-pulse rounded bg-slate-100 dark:bg-slate-600 h-3" style={{ width: `${45 + ((i + j) * 13) % 30}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {state === 'editing' && plan && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {totalEpics} epic{totalEpics !== 1 ? 's' : ''},{' '}
                {totalTasks} task{totalTasks !== 1 ? 's' : ''},{' '}
                {totalSubtasks} subtask{totalSubtasks !== 1 ? 's' : ''}
              </p>
            </div>
            <HierarchicalPlanEditor plan={plan} onChange={setPlan} />

            {showFeedback && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What would you like to change?"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-brand-green"
                  disabled={loading}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={loading || !feedback.trim()}
                  className="rounded-lg"
                >
                  {generating ? 'Regenerating...' : 'Regenerate with Feedback'}
                </Button>
              </div>
            )}
          </>
        )}

        {state === 'committing' && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Creating tasks...
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
        <div>
          {state === 'editing' && (
            <button
              onClick={handleRegenerate}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              disabled={loading}
            >
              Regenerate
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300"
            disabled={loading}
          >
            Cancel
          </button>
          {state === 'prompt' && (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="rounded-lg"
            >
              {generating ? 'Generating...' : 'Generate Plan'}
            </Button>
          )}
          {state === 'editing' && (
            <Button
              size="sm"
              onClick={handleCommit}
              disabled={loading}
              className="rounded-lg"
            >
              Commit Plan
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
