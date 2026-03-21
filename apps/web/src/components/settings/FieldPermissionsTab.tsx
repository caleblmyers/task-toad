import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import {
  FIELD_PERMISSIONS_QUERY,
  SET_FIELD_PERMISSION_MUTATION,
  DELETE_FIELD_PERMISSION_MUTATION,
} from '../../api/queries';

const FIELD_NAMES = ['priority', 'estimatedHours', 'storyPoints', 'dueDate', 'assigneeId'] as const;
const ROLES = ['viewer', 'editor', 'admin'] as const;

const FIELD_LABELS: Record<string, string> = {
  priority: 'Priority',
  estimatedHours: 'Estimated Hours',
  storyPoints: 'Story Points',
  dueDate: 'Due Date',
  assigneeId: 'Assignee',
};

interface FieldPermission {
  id: string;
  projectId: string;
  fieldName: string;
  allowedRoles: string[];
  createdAt: string;
}

interface Props {
  projectId: string;
}

export default function FieldPermissionsTab({ projectId }: Props) {
  const [permissions, setPermissions] = useState<FieldPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { fieldPermissions } = await gql<{ fieldPermissions: FieldPermission[] }>(
        FIELD_PERMISSIONS_QUERY,
        { projectId },
      );
      setPermissions(fieldPermissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load field permissions');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getPermission = (fieldName: string) =>
    permissions.find((p) => p.fieldName === fieldName);

  const handleRoleToggle = useCallback(
    async (fieldName: string, role: string) => {
      const existing = permissions.find((p) => p.fieldName === fieldName);
      const currentRoles = existing?.allowedRoles ?? [];
      const newRoles = currentRoles.includes(role)
        ? currentRoles.filter((r) => r !== role)
        : [...currentRoles, role];

      try {
        if (newRoles.length === 0) {
          // Remove the restriction entirely
          if (existing) {
            await gql<{ deleteFieldPermission: boolean }>(
              DELETE_FIELD_PERMISSION_MUTATION,
              { projectId, fieldName },
            );
            setPermissions((prev) => prev.filter((p) => p.fieldName !== fieldName));
          }
        } else {
          const { setFieldPermission } = await gql<{ setFieldPermission: FieldPermission }>(
            SET_FIELD_PERMISSION_MUTATION,
            { projectId, fieldName, allowedRoles: newRoles },
          );
          setPermissions((prev) => {
            const idx = prev.findIndex((p) => p.fieldName === fieldName);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = setFieldPermission;
              return updated;
            }
            return [...prev, setFieldPermission];
          });
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update field permission');
      }
    },
    [projectId, permissions],
  );

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Field Edit Permissions
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Restrict which roles can edit specific task fields. Unchecked fields are editable by
          anyone with task edit permission.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
          {error}
        </div>
      )}

      <div className="border border-slate-200 dark:border-slate-600 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">
                Field
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  className="text-center px-3 py-2 text-slate-600 dark:text-slate-300 font-medium capitalize"
                >
                  {role}
                </th>
              ))}
              <th className="text-center px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {FIELD_NAMES.map((fieldName) => {
              const perm = getPermission(fieldName);
              const isRestricted = !!perm;
              return (
                <tr
                  key={fieldName}
                  className="border-t border-slate-200 dark:border-slate-600"
                >
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {FIELD_LABELS[fieldName]}
                  </td>
                  {ROLES.map((role) => (
                    <td key={role} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={perm?.allowedRoles.includes(role) ?? false}
                        onChange={() => handleRoleToggle(fieldName, role)}
                        className="rounded border-slate-300 dark:border-slate-500"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        isRestricted
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}
                    >
                      {isRestricted ? 'Restricted' : 'Open'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
