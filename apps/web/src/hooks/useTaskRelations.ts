import { useState, useCallback } from 'react';
import { gql } from '../api/client';
import {
  COMMENTS_QUERY, ACTIVITIES_QUERY, CREATE_COMMENT_MUTATION, UPDATE_COMMENT_MUTATION,
  DELETE_COMMENT_MUTATION, CREATE_LABEL_MUTATION, DELETE_LABEL_MUTATION,
  ADD_TASK_LABEL_MUTATION, REMOVE_TASK_LABEL_MUTATION, LABELS_QUERY,
  ADD_TASK_ASSIGNEE_MUTATION, REMOVE_TASK_ASSIGNEE_MUTATION,
} from '../api/queries';
import type { Task, Comment, Activity, Label, TaskAssignee, CodeReview } from '../types';

interface UseTaskRelationsOptions {
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setSelectedTask: React.Dispatch<React.SetStateAction<Task | null>>;
  selectedTask: Task | null;
  setErr: (err: string | null) => void;
  loadTasks: () => Promise<Task[]>;
}

export function useTaskRelations({ setTasks, setSelectedTask, selectedTask, setErr, loadTasks }: UseTaskRelationsOptions) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [taskActivities, setTaskActivities] = useState<Record<string, Activity[]>>({});
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [reviewResult, setReviewResult] = useState<CodeReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // ── Data loading ──

  const loadComments = useCallback(async (taskId: string) => {
    try {
      const data = await gql<{ comments: Comment[] }>(COMMENTS_QUERY, { taskId });
      setComments((prev) => ({ ...prev, [taskId]: data.comments }));
    } catch {
      // ignore
    }
  }, []);

  const loadTaskActivities = useCallback(async (taskId: string) => {
    try {
      const data = await gql<{ activities: { activities: Activity[]; hasMore: boolean } }>(ACTIVITIES_QUERY, { taskId });
      setTaskActivities((prev) => ({ ...prev, [taskId]: data.activities.activities }));
    } catch {
      // ignore
    }
  }, []);

  const loadLabels = useCallback(async () => {
    try {
      const data = await gql<{ labels: Label[] }>(LABELS_QUERY);
      setLabels(data.labels);
    } catch {
      // ignore
    }
  }, []);

  // ── Labels ──

  const handleCreateLabel = useCallback(async (name: string, color: string): Promise<Label | null> => {
    try {
      const data = await gql<{ createLabel: Label }>(CREATE_LABEL_MUTATION, { name, color });
      setLabels((prev) => [...prev, data.createLabel].sort((a, b) => a.name.localeCompare(b.name)));
      return data.createLabel;
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create label');
      return null;
    }
  }, [setErr]);

  const handleDeleteLabel = useCallback(async (labelId: string) => {
    try {
      await gql<{ deleteLabel: boolean }>(DELETE_LABEL_MUTATION, { labelId });
      setLabels((prev) => prev.filter((l) => l.labelId !== labelId));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete label');
    }
  }, [setErr]);

  const handleAddTaskLabel = useCallback(async (taskId: string, labelId: string) => {
    const label = labels.find((l) => l.labelId === labelId);
    if (!label) return;
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, labels: [...(t.labels ?? []), label] } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, labels: [...(t.labels ?? []), label] } : t);
    try {
      await gql<{ addTaskLabel: Task }>(ADD_TASK_LABEL_MUTATION, { taskId, labelId });
    } catch {
      loadTasks();
    }
  }, [labels, loadTasks, setTasks, setSelectedTask]);

  const handleRemoveTaskLabel = useCallback(async (taskId: string, labelId: string) => {
    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId ? { ...t, labels: (t.labels ?? []).filter((l) => l.labelId !== labelId) } : t
    ));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, labels: (t.labels ?? []).filter((l) => l.labelId !== labelId) } : t);
    try {
      await gql<{ removeTaskLabel: Task }>(REMOVE_TASK_LABEL_MUTATION, { taskId, labelId });
    } catch {
      loadTasks();
    }
  }, [loadTasks, setTasks, setSelectedTask]);

  // ── Assignees ──

  const handleAddAssignee = useCallback(async (taskId: string, userId: string) => {
    try {
      const data = await gql<{ addTaskAssignee: TaskAssignee }>(ADD_TASK_ASSIGNEE_MUTATION, { taskId, userId });
      const newAssignee = data.addTaskAssignee;
      setTasks((prev) => prev.map((t) =>
        t.taskId === taskId ? { ...t, assignees: [...(t.assignees ?? []), newAssignee] } : t
      ));
      setSelectedTask((t) => t?.taskId === taskId ? { ...t, assignees: [...(t.assignees ?? []), newAssignee] } : t);
    } catch {
      loadTasks();
    }
  }, [loadTasks, setTasks, setSelectedTask]);

  const handleRemoveAssignee = useCallback(async (taskId: string, userId: string) => {
    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId ? { ...t, assignees: (t.assignees ?? []).filter((a) => a.user.userId !== userId) } : t
    ));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, assignees: (t.assignees ?? []).filter((a) => a.user.userId !== userId) } : t);
    try {
      await gql<{ removeTaskAssignee: boolean }>(REMOVE_TASK_ASSIGNEE_MUTATION, { taskId, userId });
    } catch {
      loadTasks();
    }
  }, [loadTasks, setTasks, setSelectedTask]);

  // ── AI Review ──

  const handleReviewPR = useCallback(async (taskId: string, prNumber: number): Promise<CodeReview | null> => {
    setReviewLoading(true);
    setReviewResult(null);
    try {
      const data = await gql<{ reviewPullRequest: CodeReview }>(
        `mutation ReviewPR($taskId: ID!, $prNumber: Int!) {
          reviewPullRequest(taskId: $taskId, prNumber: $prNumber) {
            summary approved
            comments { file line severity comment }
            suggestions
          }
        }`,
        { taskId, prNumber },
      );
      setReviewResult(data.reviewPullRequest);
      return data.reviewPullRequest;
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to review PR');
      return null;
    } finally {
      setReviewLoading(false);
    }
  }, [setErr]);

  // ── Comments ──

  const handleCreateComment = useCallback(async (taskId: string, content: string, parentCommentId?: string) => {
    try {
      await gql<{ createComment: Comment }>(
        CREATE_COMMENT_MUTATION, { taskId, content, parentCommentId: parentCommentId ?? null },
      );
      await loadComments(taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create comment');
    }
  }, [loadComments, setErr]);

  const handleUpdateComment = useCallback(async (commentId: string, content: string) => {
    try {
      await gql<{ updateComment: Comment }>(UPDATE_COMMENT_MUTATION, { commentId, content });
      if (selectedTask) await loadComments(selectedTask.taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update comment');
    }
  }, [selectedTask, loadComments, setErr]);

  const handleDeleteComment = useCallback(async (commentId: string, taskId: string) => {
    try {
      await gql<{ deleteComment: boolean }>(DELETE_COMMENT_MUTATION, { commentId });
      await loadComments(taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete comment');
    }
  }, [loadComments, setErr]);

  return {
    // State
    labels, comments, taskActivities, selectedTaskIds, reviewResult, reviewLoading,
    // Setters
    setSelectedTaskIds,
    // Data loaders
    loadLabels, loadComments, loadTaskActivities,
    // Labels
    handleCreateLabel, handleDeleteLabel, handleAddTaskLabel, handleRemoveTaskLabel,
    // Assignees
    handleAddAssignee, handleRemoveAssignee,
    // Comments
    handleCreateComment, handleUpdateComment, handleDeleteComment,
    // AI Review
    handleReviewPR,
  };
}
