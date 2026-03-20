import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import {
  PROJECT_MEMBERS_QUERY,
  ADD_PROJECT_MEMBER_MUTATION,
  REMOVE_PROJECT_MEMBER_MUTATION,
  UPDATE_PROJECT_MEMBER_ROLE_MUTATION,
} from '../../api/queries';
import { useFormState } from '../../hooks/useFormState';
import { useCan } from '../../hooks/PermissionContext';
import type { OrgUser } from '../../types';
import Button from '../shared/Button';

interface ProjectMember {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Props {
  projectId: string;
  orgUsers: OrgUser[];
}

export default function MembersTab({ projectId, orgUsers }: Props) {
  const can = useCan();
  const canManageMembers = can('MANAGE_PROJECT_SETTINGS');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addMemberForm = useFormState(
    { userId: '', role: 'editor' },
    async (values) => {
      if (!values.userId) return;
      const { addProjectMember } = await gql<{ addProjectMember: ProjectMember }>(
        ADD_PROJECT_MEMBER_MUTATION,
        { projectId, userId: values.userId, role: values.role },
      );
      setMembers((prev) => [...prev.filter((m) => m.userId !== addProjectMember.userId), addProjectMember]);
      addMemberForm.setValues((prev) => ({ ...prev, userId: '' }));
    },
  );

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gql<{ projectMembers: ProjectMember[] }>(
        PROJECT_MEMBERS_QUERY,
        { projectId },
      );
      setMembers(data.projectMembers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleRemoveMember = async (userId: string) => {
    setError(null);
    try {
      await gql<{ removeProjectMember: boolean }>(
        REMOVE_PROJECT_MEMBER_MUTATION,
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
        UPDATE_PROJECT_MEMBER_ROLE_MUTATION,
        { projectId, userId, role },
      );
      setMembers((prev) => prev.map((m) => (m.userId === userId ? updateProjectMemberRole : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const availableUsers = orgUsers.filter((u) => !members.some((m) => m.userId === u.userId));

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>;

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {members.map((m) => (
          <li key={m.id} className="py-2 flex items-center justify-between text-sm">
            <span className="text-slate-800">{m.email}</span>
            <div className="flex items-center gap-2">
              {canManageMembers ? (
                <>
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
                </>
              ) : (
                <span className="text-xs text-slate-500 capitalize">{m.role}</span>
              )}
            </div>
          </li>
        ))}
        {members.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No project members yet.</li>}
      </ul>

      {canManageMembers && <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add member</p>
        {addMemberForm.error && <p className="text-sm text-red-600 mb-2">{addMemberForm.error}</p>}
        <div className="flex items-center gap-2">
          <select
            value={addMemberForm.values.userId}
            onChange={(e) => addMemberForm.setValue('userId', e.target.value)}
            className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
          >
            <option value="">Select user...</option>
            {availableUsers.map((u) => (
              <option key={u.userId} value={u.userId}>{u.email}</option>
            ))}
          </select>
          <select
            value={addMemberForm.values.role}
            onChange={(e) => addMemberForm.setValue('role', e.target.value)}
            className="text-sm border border-slate-300 rounded px-2 py-1.5"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <Button size="sm" disabled={addMemberForm.loading || !addMemberForm.values.userId} onClick={() => addMemberForm.handleSubmit()}>
            {addMemberForm.loading ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>}
    </>
  );
}
