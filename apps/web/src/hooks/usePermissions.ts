import { useState, useCallback, useEffect } from 'react';
import { gql } from '../api/client';
import { MY_PERMISSIONS_QUERY } from '../api/queries';

interface PermissionsResult {
  permissions: string[];
  can: (permission: string) => boolean;
  loading: boolean;
}

export function usePermissions(projectId: string | undefined): PermissionsResult {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPermissions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { myPermissions } = await gql<{ myPermissions: string[] }>(
        MY_PERMISSIONS_QUERY,
        { projectId },
      );
      setPermissions(myPermissions);
    } catch {
      // If permissions query fails (e.g. not logged in), default to empty
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  const can = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  return { permissions, can, loading };
}
