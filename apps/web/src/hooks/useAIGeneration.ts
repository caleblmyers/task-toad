import { useState, useCallback, useRef } from 'react';
import { gql } from '../api/client';
import {
  PREVIEW_TASK_PLAN_MUTATION, COMMIT_TASK_PLAN_MUTATION, SUMMARIZE_PROJECT_MUTATION,
  GENERATE_INSTRUCTIONS_MUTATION, GENERATE_CODE_MUTATION, REGENERATE_FILE_MUTATION,
  CREATE_PR_MUTATION, PARSE_BUG_REPORT_MUTATION, PREVIEW_PRD_MUTATION,
  COMMIT_PRD_MUTATION, BOOTSTRAP_REPO_MUTATION,
} from '../api/queries';
import type { Task, TaskPlanPreview } from '../types';

interface GeneratedCode {
  files: Array<{ path: string; content: string; language: string; description: string }>;
  summary: string;
  estimatedTokensUsed: number;
  delegationHint?: string | null;
}

interface UseAIGenerationOptions {
  projectId: string | undefined;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setSubtasks: React.Dispatch<React.SetStateAction<Record<string, Task[]>>>;
  setSelectedTask: React.Dispatch<React.SetStateAction<Task | null>>;
  selectedTask: Task | null;
  setErr: (err: string | null) => void;
  loadTasks: () => Promise<Task[]>;
  loadSubtasks: (taskId: string) => void;
}

export function useAIGeneration({
  projectId, setTasks, setSubtasks, setSelectedTask, selectedTask,
  setErr, loadTasks, loadSubtasks,
}: UseAIGenerationOptions) {
  const [previewTasks, setPreviewTasks] = useState<TaskPlanPreview[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [generatingInstructions, setGeneratingInstructions] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [creatingPR, setCreatingPR] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const isGenerating = previewLoading || summarizing || committing || generatingInstructions !== null || generatingCode !== null;

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
      const data = await gql<{ commitTaskPlan: Task[] }>(
        COMMIT_TASK_PLAN_MUTATION,
        {
          projectId,
          tasks: selectedTasks.map((t) => ({
            title: t.title, description: t.description, instructions: t.instructions,
            suggestedTools: t.suggestedTools, estimatedHours: t.estimatedHours,
            priority: t.priority, dependsOn: t.dependsOn, subtasks: t.subtasks,
          })),
          clearExisting: true,
        },
        controller.signal,
      );
      setTasks(data.commitTaskPlan);
      setSubtasks({});
      setSelectedTask(null);
      setPreviewTasks(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to create tasks');
    } finally {
      setCommitting(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [projectId, setTasks, setSubtasks, setSelectedTask, setErr]);

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
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [setTasks, setSelectedTask, setErr, loadSubtasks]);

  const handleGenerateCode = useCallback(async (task: Task) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneratingCode(task.taskId);
    try {
      const styleGuide = projectId ? localStorage.getItem(`tasktoad-style-guide-${projectId}`) : null;
      const data = await gql<{ generateCodeFromTask: GeneratedCode }>(
        GENERATE_CODE_MUTATION, { taskId: task.taskId, styleGuide }, controller.signal,
      );
      setGeneratedCode(data.generateCodeFromTask);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setErr((err as Error).message || 'Code generation failed');
      }
    } finally {
      setGeneratingCode(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [projectId, setErr]);

  const handleRegenerateFile = useCallback(async (
    taskId: string, filePath: string, feedback?: string,
  ): Promise<{ path: string; content: string; language: string; description: string } | null> => {
    try {
      const data = await gql<{ regenerateCodeFile: { path: string; content: string; language: string; description: string } }>(
        REGENERATE_FILE_MUTATION, { taskId, filePath, feedback: feedback || null },
      );
      const newFile = data.regenerateCodeFile;
      setGeneratedCode((prev) => {
        if (!prev) return prev;
        return { ...prev, files: prev.files.map((f) => f.path === filePath ? newFile : f) };
      });
      return newFile;
    } catch (err: unknown) {
      setErr((err as Error).message || 'Failed to regenerate file');
      return null;
    }
  }, [setErr]);

  const handleCreatePR = useCallback(async (files: Array<{ path: string; content: string }>) => {
    if (!selectedTask || !projectId) return;
    setCreatingPR(true);
    try {
      await gql(CREATE_PR_MUTATION, { projectId, taskId: selectedTask.taskId, files });
      setErr(null);
      setGeneratedCode(null);
    } catch (err: unknown) {
      setErr((err as Error).message || 'Failed to create PR');
    } finally {
      setCreatingPR(false);
    }
  }, [selectedTask, projectId, setErr]);

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

  return {
    previewTasks, previewLoading, previewError, committing,
    summary, summarizing, generatingInstructions, generatingCode,
    generatedCode, creatingPR, isGenerating,
    abortRef,
    openPreview, handleCommitPlan, handleSummarize,
    handleGenerateInstructions, handleGenerateCode,
    handleRegenerateFile, handleCreatePR,
    handleParseBugReport, handlePreviewPRD, handleCommitPRD, handleBootstrapFromRepo,
    setPreviewTasks, setPreviewError, setSummary, setGeneratedCode,
  };
}
