import { useState, useCallback, useRef } from 'react';
import { gql } from '../api/client';
import {
  PREVIEW_TASK_PLAN_MUTATION, COMMIT_TASK_PLAN_MUTATION, SUMMARIZE_PROJECT_MUTATION,
  GENERATE_INSTRUCTIONS_MUTATION, GENERATE_CODE_MUTATION, GENERATE_CODE_FROM_CHILD_TASK_MUTATION,
  REGENERATE_FILE_MUTATION, PLAN_CODE_MUTATION, GENERATE_PLANNED_FILE_MUTATION,
  CREATE_PR_MUTATION, PARSE_BUG_REPORT_MUTATION, PREVIEW_PRD_MUTATION,
  COMMIT_PRD_MUTATION, BOOTSTRAP_REPO_MUTATION,
} from '../api/queries';
import type { Task, TaskPlanPreview } from '../types';

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  description: string;
}

interface GeneratedCode {
  files: GeneratedFile[];
  summary: string;
  estimatedTokensUsed: number;
  delegationHint?: string | null;
}

interface CodePlanFile {
  path: string;
  language: string;
  description: string;
  exports: string;
  dependsOn: string[];
}

interface CodePlan {
  files: CodePlanFile[];
  architecture: string;
  generationOrder: string[];
}

export interface CodeGenProgress {
  plan: CodePlan;
  completedFiles: GeneratedFile[];
  completedExports: string[];
  pendingFiles: string[];
  currentFile: string | null;
  errors: Record<string, string>;
  status: 'planning' | 'planned' | 'generating' | 'complete' | 'error';
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

/** Extract export lines from generated file content for context threading */
function extractExports(content: string): string {
  const exportLines = content.match(/^export\s+.*/gm) ?? [];
  return exportLines.slice(0, 20).join('\n');
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
  const [codeGenProgress, setCodeGenProgress] = useState<CodeGenProgress | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const subtaskAbortRef = useRef<AbortController | null>(null);

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
            priority: t.priority, dependsOn: t.dependsOn, tasks: t.tasks,
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

  // ── Multi-step code generation (plan-then-generate) ──

  const handlePlanCodeGeneration = useCallback(async (task: Task) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneratingCode(task.taskId);
    setCodeGenProgress(null);
    try {
      const styleGuide = projectId ? localStorage.getItem(`tasktoad-style-guide-${projectId}`) : null;
      const data = await gql<{ planCodeGeneration: CodePlan }>(
        PLAN_CODE_MUTATION, { taskId: task.taskId, styleGuide }, controller.signal,
      );
      const plan = data.planCodeGeneration;
      const order = plan.generationOrder.length > 0
        ? plan.generationOrder
        : plan.files.map((f) => f.path);
      setCodeGenProgress({
        plan,
        completedFiles: [],
        completedExports: [],
        pendingFiles: order,
        currentFile: null,
        errors: {},
        status: 'planned',
      });
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setErr((err as Error).message || 'Failed to plan code generation');
      }
    } finally {
      setGeneratingCode(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [projectId, setErr]);

  const handleGeneratePlannedFiles = useCallback(async (taskId: string, filePaths?: string[]) => {
    const progress = codeGenProgress;
    if (!progress || !projectId) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const styleGuide = localStorage.getItem(`tasktoad-style-guide-${projectId}`);
    const planContext = JSON.stringify({
      files: progress.plan.files.map((f) => ({ path: f.path, description: f.description, exports: f.exports })),
      architecture: progress.plan.architecture,
    });

    const toGenerate = filePaths ?? progress.pendingFiles;
    setCodeGenProgress((prev) => prev ? { ...prev, status: 'generating' } : prev);

    let completedFiles = [...progress.completedFiles];
    let completedExports = [...progress.completedExports];
    let totalTokens = 0;

    for (const filePath of toGenerate) {
      if (controller.signal.aborted) break;

      const planFile = progress.plan.files.find((f) => f.path === filePath);
      if (!planFile) continue;

      setCodeGenProgress((prev) => prev ? {
        ...prev,
        currentFile: filePath,
        pendingFiles: prev.pendingFiles.filter((p) => p !== filePath),
      } : prev);

      try {
        const data = await gql<{ generatePlannedFile: GeneratedFile }>(
          GENERATE_PLANNED_FILE_MUTATION,
          {
            taskId,
            filePath,
            fileDescription: planFile.description,
            planContext,
            completedExports,
            styleGuide,
          },
          controller.signal,
        );

        const file = data.generatePlannedFile;
        completedFiles = [...completedFiles, file];
        const exports = extractExports(file.content);
        if (exports) {
          completedExports = [...completedExports, `${filePath}: ${exports}`];
        }
        totalTokens += file.content.length / 4; // rough estimate

        setCodeGenProgress((prev) => prev ? {
          ...prev,
          completedFiles,
          completedExports,
        } : prev);
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') break;
        setCodeGenProgress((prev) => prev ? {
          ...prev,
          errors: { ...prev.errors, [filePath]: (err as Error).message || 'Generation failed' },
        } : prev);
      }
    }

    // Finalize — set generatedCode so CodePreviewModal shows the result
    setCodeGenProgress((prev) => prev ? {
      ...prev,
      currentFile: null,
      status: 'complete',
    } : prev);

    if (completedFiles.length > 0) {
      setGeneratedCode({
        files: completedFiles,
        summary: progress.plan.architecture,
        estimatedTokensUsed: Math.round(totalTokens),
      });
    }

    if (abortRef.current === controller) abortRef.current = null;
  }, [codeGenProgress, projectId]);

  const handleRetryPlannedFile = useCallback(async (taskId: string, filePath: string) => {
    await handleGeneratePlannedFiles(taskId, [filePath]);
  }, [handleGeneratePlannedFiles]);

  // ── Single-call code generation ──

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
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to generate code');
    } finally {
      setGeneratingCode(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [projectId, setErr]);

  const handleGenerateCodeFromChildTask = useCallback(async (taskId: string, subtaskId: string): Promise<GeneratedCode | null> => {
    const controller = new AbortController();
    subtaskAbortRef.current = controller;
    try {
      const styleGuide = projectId ? localStorage.getItem(`tasktoad-style-guide-${projectId}`) : null;
      const data = await gql<{ generateCodeFromSubtask: GeneratedCode }>(
        GENERATE_CODE_FROM_CHILD_TASK_MUTATION, { taskId, subtaskId, styleGuide }, controller.signal,
      );
      return data.generateCodeFromSubtask;
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setErr((err as Error).message || 'Child task code generation failed');
      }
      return null;
    } finally {
      if (subtaskAbortRef.current === controller) subtaskAbortRef.current = null;
    }
  }, [projectId, setErr]);

  const cancelSubtaskGeneration = useCallback(() => {
    subtaskAbortRef.current?.abort();
    subtaskAbortRef.current = null;
  }, []);

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
      setCodeGenProgress(null);
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
    codeGenProgress,
    abortRef,
    openPreview, handleCommitPlan, handleSummarize,
    handleGenerateInstructions, handleGenerateCode, handleGenerateCodeFromChildTask,
    handleRegenerateFile, handleCreatePR,
    handlePlanCodeGeneration, handleGeneratePlannedFiles, handleRetryPlannedFile,
    handleParseBugReport, handlePreviewPRD, handleCommitPRD, handleBootstrapFromRepo,
    cancelSubtaskGeneration,
    setPreviewTasks, setPreviewError, setSummary, setGeneratedCode, setCodeGenProgress,
  };
}
