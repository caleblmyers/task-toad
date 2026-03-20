import { useCallback } from 'react';
import { useTaskOperations } from './useTaskOperations';
import { useTaskRelations } from './useTaskRelations';
import type { Task, Sprint } from '../types';

interface UseTaskCRUDOptions {
  projectId: string | undefined;
  userId: string | undefined;
  sprints: Sprint[];
}

export function useTaskCRUD({ projectId, userId, sprints }: UseTaskCRUDOptions) {
  const ops = useTaskOperations({ projectId, userId, sprints });

  const relations = useTaskRelations({
    setTasks: ops.setTasks,
    setSelectedTask: ops.setSelectedTask,
    selectedTask: ops.selectedTask,
    setErr: ops.setErr,
    loadTasks: ops.loadTasks,
  });

  // selectTask spans both sub-hooks: sets selection + loads subtasks, comments, activities
  const selectTask = useCallback((task: Task) => {
    ops.setSelectedTask(task);
    ops.loadSubtasks(task.taskId);
    relations.loadComments(task.taskId);
    relations.loadTaskActivities(task.taskId);
  }, [ops, relations]);

  return {
    // From operations
    tasks: ops.tasks, hasMore: ops.hasMore, loading: ops.loading, err: ops.err,
    selectedTask: ops.selectedTask, subtasks: ops.subtasks,
    showAddForm: ops.showAddForm, newTaskTitle: ops.newTaskTitle, addErr: ops.addErr,
    editingTitle: ops.editingTitle, editTitleValue: ops.editTitleValue,
    titleEditRef: ops.titleEditRef, rootTasks: ops.rootTasks,
    setTasks: ops.setTasks, setSubtasks: ops.setSubtasks,
    setSelectedTask: ops.setSelectedTask, setErr: ops.setErr,
    setShowAddForm: ops.setShowAddForm, setNewTaskTitle: ops.setNewTaskTitle,
    setEditTitleValue: ops.setEditTitleValue, setEditingTitle: ops.setEditingTitle,
    loadTasks: ops.loadTasks, loadMoreTasks: ops.loadMoreTasks, loadSubtasks: ops.loadSubtasks,
    handleStatusChange: ops.handleStatusChange, handleSubtaskStatusChange: ops.handleSubtaskStatusChange,
    handleSprintColumnChange: ops.handleSprintColumnChange, handleAssignSprint: ops.handleAssignSprint,
    handleAssignUser: ops.handleAssignUser, handleDueDateChange: ops.handleDueDateChange,
    handleReorderTask: ops.handleReorderTask, handleAddDependency: ops.handleAddDependency, handleRemoveDependency: ops.handleRemoveDependency,
    handleAddTask: ops.handleAddTask, handleBulkCreateTasks: ops.handleBulkCreateTasks,
    handleCreateSubtask: ops.handleCreateSubtask,
    startEditTitle: ops.startEditTitle, handleTitleSave: ops.handleTitleSave,
    handleUpdateTask: ops.handleUpdateTask, handleBulkUpdate: ops.handleBulkUpdate,
    handleArchiveTask: ops.handleArchiveTask,

    // From relations
    labels: relations.labels, comments: relations.comments,
    taskActivities: relations.taskActivities, selectedTaskIds: relations.selectedTaskIds,
    reviewResult: relations.reviewResult, reviewLoading: relations.reviewLoading,
    setSelectedTaskIds: relations.setSelectedTaskIds,
    loadLabels: relations.loadLabels,
    handleCreateLabel: relations.handleCreateLabel, handleDeleteLabel: relations.handleDeleteLabel,
    handleAddTaskLabel: relations.handleAddTaskLabel, handleRemoveTaskLabel: relations.handleRemoveTaskLabel,
    handleAddAssignee: relations.handleAddAssignee, handleRemoveAssignee: relations.handleRemoveAssignee,
    handleAddWatcher: relations.handleAddWatcher, handleRemoveWatcher: relations.handleRemoveWatcher,
    handleCreateComment: relations.handleCreateComment, handleUpdateComment: relations.handleUpdateComment,
    handleDeleteComment: relations.handleDeleteComment,
    handleReviewPR: relations.handleReviewPR,

    // Composed
    selectTask,
  };
}
