import { useState, useCallback, useRef, useEffect } from 'react';
import { gql } from '../api/client';
import {
  PREVIEW_TASK_PLAN_MUTATION, COMMIT_TASK_PLAN_MUTATION, SUMMARIZE_PROJECT_MUTATION,
  GENERATE_INSTRUCTIONS_MUTATION,
  PARSE_BUG_REPORT_MUTATION, PREVIEW_PRD_MUTATION,
  COMMIT_PRD_MUTATION, BOOTSTRAP_REPO_MUTATION,
  PREVIEW_ACTION_PLAN_MUTATION, COMMIT_ACTION_PLAN_MUTATION, EXECUTE_ACTION_PLAN_MUTATION,
  COMPLETE_MANUAL_ACTION_MUTATION, SKIP_ACTION_MUTATION, RETRY_ACTION_MUTATION,
  CANCEL_ACTION_PLAN_MUTATION, TASK_ACTION_PLAN_QUERY,
  PROJECT_ACTION_PLANS_QUERY,
} from '../api/queries';
import type { Task, TaskPlanPreview, ActionPlanPreview, TaskActionPlan } from '../types';

interface UseAIGenerationOptions {
  projectId: string | undefined;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setSubtasks: React.Dispatch<React.SetStateAction<Record<string, Task[]>>>;
  setSelectedTask: React.Dispatch<React.SetStateAction<Task | null>>;
  setErr: (err: string | null) => void;
  loadTasks: () => Promise<Task[]>;
  loadSubtasks: (taskId: string) => void;
}

export function useAIGeneration({
  projectId, setTasks, setSubtasks, setSelectedTask,
  setErr, loadTasks, loadSubtasks,
}: UseAIGenerationOptions) {
  const [previewTasks, setPreviewTasks] = useState<TaskPlanPreview[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [generatingInstructions, setGeneratingInstructions] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isGenerating = previewLoading || summarizing || committing || generatingInstructions !== null;

  const openPreview = useCallback(async (context?: string, appendToTitles?: string[]) => {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPreviewLoading(true);
    setPreviewError(null);
    if (!appendToTitles) setPreviewTasks([]);
    try {
      const data = await gql<{ previewTaskPlan: TaskPlanPreview[] }>(
        PREVIEW_TASK_PLAN_MUTATION,
        { projectId, context: context ?? null, appendToTitles: appendToTitles ?? null },
        controller.signal,
      );
      setPreviewTasks((prev) => {
        if (appendToTitles && prev) {
          const existingTitles = new Set(prev.map((t) => t.title));
          const newTasks = data.previewTaskPlan.filter((t) => !existingTitles.has(t.title));
          return [...prev, ...newTasks];
        }
        return data.previewTaskPlan;
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setPreviewError(error instanceof Error ? error.message : 'Failed to generate task plan');
    } finally {
      setPreviewLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [projectId]);

  const handleCommitPlan = useCallback(async (selectedTasks: TaskPlanPreview[]) => {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setCommitting(true);
    setErr(null);
    try {
      await gql<{ commitTaskPlan: Task[] }>(
        COMMIT_TASK_PLAN_MUTATION,
        {
          projectId,
          tasks: selectedTasks.map((t) => ({
            title: t.title, description: t.description, instructions: t.instructions,
            suggestedTools: t.suggestedTools, estimatedHours: t.estimatedHours,
            priority: t.priority, dependsOn: t.dependsOn, tasks: t.tasks,
          })),
          clearExisting: true,
        },
        controller.signal,
      );
      setSubtasks({});
      setSelectedTask(null);
      setPreviewTasks(null);
      await loadTasks();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to create tasks');
    } finally {
      setCommitting(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [projectId, setSubtasks, setSelectedTask, setErr, loadTasks]);

  const handleSummarize = useCallback(async () => {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setSummarizing(true);
    setErr(null);
    setSummary(null);
    try {
      const data = await gql<{ summarizeProject: string }>(
        SUMMARIZE_PROJECT_MUTATION, { projectId }, controller.signal,
      );
      setSummary(data.summarizeProject);
      setSelectedTask(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to summarize project');
    } finally {
      setSummarizing(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [projectId, setSelectedTask, setErr]);

  const handleGenerateInstructions = useCallback(async (task: Task) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneratingInstructions(task.taskId);
    setLoadingMessage('Generating implementation instructions...');
    try {
      const data = await gql<{ generateTaskInstructions: Task }>(
        GENERATE_INSTRUCTIONS_MUTATION, { taskId: task.taskId }, controller.signal,
      );
      const updated = data.generateTaskInstructions;
      setTasks((prev) => prev.map((t) => t.taskId === updated.taskId ? updated : t));
      setSelectedTask(updated);
      loadSubtasks(updated.taskId);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to generate instructions');
    } finally {
      setGeneratingInstructions(null);
      setLoadingMessage(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [setTasks, setSelectedTask, setErr, loadSubtasks]);

  const handleParseBugReport = useCallback(async (bugReport: string) => {
    if (!projectId) return;
    const data = await gql<{ parseBugReport: Task }>(
      PARSE_BUG_REPORT_MUTATION, { projectId, bugReport },
    );
    setTasks((prev) => [...prev, data.parseBugReport]);
  }, [projectId, setTasks]);

  const handlePreviewPRD = useCallback(async (prd: string) => {
    if (!projectId) throw new Error('No project');
    const data = await gql<{ previewPRDBreakdown: { epics: Array<{ title: string; description: string; tasks: Array<{ title: string; description: string; priority: string; estimatedHours?: number | null; acceptanceCriteria?: string | null }> }> } }>(
      PREVIEW_PRD_MUTATION, { projectId, prd },
    );
    return data.previewPRDBreakdown;
  }, [projectId]);

  const handleCommitPRD = useCallback(async (epics: string) => {
    if (!projectId) return;
    await gql<{ commitPRDBreakdown: Task[] }>(COMMIT_PRD_MUTATION, { projectId, epics });
    await loadTasks();
  }, [projectId, loadTasks]);

  const handleBootstrapFromRepo = useCallback(async () => {
    if (!projectId) return;
    await gql<{ bootstrapProjectFromRepo: Task[] }>(BOOTSTRAP_REPO_MUTATION, { projectId });
    await loadTasks();
  }, [projectId, loadTasks]);

  // ── Action Plan ──

  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  const [actionPlanPreview, setActionPlanPreview] = useState<ActionPlanPreview | null>(null);
  const [actionPlanPreviewLoading, setActionPlanPreviewLoading] = useState(false);
  const [actionPlan, setActionPlan] = useState<TaskActionPlan | null>(null);
  const [isProjectBusy, setIsProjectBusy] = useState(false);

  // Check if any action plan is currently active (approved/executing) on the project
  const checkProjectBusy = useCallback(async () => {
    if (!projectId) { setIsProjectBusy(false); return; }
    try {
      const data = await gql<{ projectActionPlans: Array<{ id: string; status: string }> }>(
        PROJECT_ACTION_PLANS_QUERY, { projectId },
      );
      const hasActive = data.projectActionPlans.some(
        p => p.status === 'executing' || p.status === 'approved'
      );
      setIsProjectBusy(hasActive);
    } catch {
      // ignore — default to not busy
    }
  }, [projectId]);

  // Recheck when action plan state changes
  useEffect(() => { checkProjectBusy(); }, [checkProjectBusy, actionPlan]);

  const handlePreviewActionPlan = useCallback(async (task: Task) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setActionPlanPreviewLoading(true);
    setActionPlanPreview(null);
    setLoadingMessage('Analyzing task and creating action plan...');
    try {
      const data = await gql<{ previewActionPlan: ActionPlanPreview }>(
        PREVIEW_ACTION_PLAN_MUTATION, { taskId: task.taskId }, controller.signal,
      );
      setActionPlanPreview(data.previewActionPlan);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to generate action plan');
    } finally {
      setActionPlanPreviewLoading(false);
      setLoadingMessage(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [setErr]);

  const handleCommitActionPlan = useCallback(async (taskId: string, actions: Array<{ actionType: string; label: string; config: string; requiresApproval: boolean }>) => {
    setLoadingMessage('Saving action plan...');
    try {
      const data = await gql<{ commitActionPlan: TaskActionPlan }>(
        COMMIT_ACTION_PLAN_MUTATION, { taskId, actions },
      );
      setActionPlan(data.commitActionPlan);
      setActionPlanPreview(null);
      return data.commitActionPlan;
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to commit action plan');
      return null;
    } finally {
      setLoadingMessage(null);
    }
  }, [setErr]);

  const handleExecuteActionPlan = useCallback(async (planId: string) => {
    setLoadingMessage('Starting execution...');
    try {
      const data = await gql<{ executeActionPlan: TaskActionPlan }>(
        EXECUTE_ACTION_PLAN_MUTATION, { planId },
      );
      setActionPlan(data.executeActionPlan);

      // The mutation enqueues the next action asynchronously — refetch after a short
      // delay so the UI shows the action transitioning to "executing" even if the
      // SSE event hasn't arrived yet.
      const taskId = data.executeActionPlan.taskId;
      if (taskId) {
        setTimeout(async () => {
          try {
            const refreshed = await gql<{ taskActionPlan: TaskActionPlan | null }>(
              TASK_ACTION_PLAN_QUERY, { taskId },
            );
            if (refreshed.taskActionPlan) setActionPlan(refreshed.taskActionPlan);
          } catch {
            // ignore — SSE will catch up
          }
        }, 1500);
      }

      return data.executeActionPlan;
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to execute action plan');
      return null;
    } finally {
      setLoadingMessage(null);
    }
  }, [setErr]);

  const handleCompleteManualAction = useCallback(async (actionId: string) => {
    try {
      await gql(COMPLETE_MANUAL_ACTION_MUTATION, { actionId });
      // Refresh the plan
      if (actionPlan) {
        const data = await gql<{ taskActionPlan: TaskActionPlan | null }>(
          TASK_ACTION_PLAN_QUERY, { taskId: actionPlan.taskId },
        );
        if (data.taskActionPlan) setActionPlan(data.taskActionPlan);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to complete action');
    }
  }, [setErr, actionPlan]);

  const handleSkipAction = useCallback(async (actionId: string) => {
    try {
      await gql(SKIP_ACTION_MUTATION, { actionId });
      if (actionPlan) {
        const data = await gql<{ taskActionPlan: TaskActionPlan | null }>(
          TASK_ACTION_PLAN_QUERY, { taskId: actionPlan.taskId },
        );
        if (data.taskActionPlan) setActionPlan(data.taskActionPlan);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to skip action');
    }
  }, [setErr, actionPlan]);

  const handleRetryAction = useCallback(async (actionId: string) => {
    try {
      await gql(RETRY_ACTION_MUTATION, { actionId });
      if (actionPlan) {
        const data = await gql<{ taskActionPlan: TaskActionPlan | null }>(
          TASK_ACTION_PLAN_QUERY, { taskId: actionPlan.taskId },
        );
        if (data.taskActionPlan) setActionPlan(data.taskActionPlan);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to retry action');
    }
  }, [setErr, actionPlan]);

  const handleCancelActionPlan = useCallback(async (planId: string) => {
    try {
      const data = await gql<{ cancelActionPlan: TaskActionPlan }>(
        CANCEL_ACTION_PLAN_MUTATION, { planId },
      );
      setActionPlan(data.cancelActionPlan);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to cancel action plan');
    }
  }, [setErr]);

  const loadActionPlan = useCallback(async (taskId: string) => {
    try {
      const data = await gql<{ taskActionPlan: TaskActionPlan | null }>(
        TASK_ACTION_PLAN_QUERY, { taskId },
      );
      setActionPlan(data.taskActionPlan);
    } catch {
      // ignore
    }
  }, []);

  return {
    previewTasks, previewLoading, previewError, committing,
    summary, summarizing, generatingInstructions,
    isGenerating, loadingMessage,
    abortRef,
    openPreview, handleCommitPlan, handleSummarize,
    handleGenerateInstructions,
    handleParseBugReport, handlePreviewPRD, handleCommitPRD, handleBootstrapFromRepo,
    setPreviewTasks, setPreviewError, setSummary,
    // Action plan
    actionPlanPreview, actionPlanPreviewLoading, actionPlan, isProjectBusy,
    handlePreviewActionPlan, handleCommitActionPlan, handleExecuteActionPlan,
    handleCompleteManualAction, handleSkipAction, handleRetryAction,
    handleCancelActionPlan, loadActionPlan, checkProjectBusy,
    setActionPlanPreview, setActionPlan,
  };
}
