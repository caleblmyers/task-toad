import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useConfirmDialog } from '../components/shared/ConfirmDialog';

interface UseProjectEffectsOptions {
  projectId: string | undefined;
  isGenerating: boolean;
  abortRef: React.MutableRefObject<AbortController | null>;
  loadAll: () => Promise<void>;
  autoPreviewCheck: (taskCount: number) => boolean;
  onAutoPreview: () => void;
}

export function useProjectEffects({
  projectId, isGenerating, abortRef,
  loadAll, autoPreviewCheck, onAutoPreview,
}: UseProjectEffectsOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const autoPreviewFiredRef = useRef(false);
  const locationState = location.state as { autoPreview?: boolean } | null;

  // Load all data on project change
  useEffect(() => {
    loadAll().then(() => {
      if (locationState?.autoPreview && autoPreviewCheck(0) && !autoPreviewFiredRef.current) {
        autoPreviewFiredRef.current = true;
        navigate(location.pathname, { replace: true, state: {} });
        onAutoPreview();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Block browser tab close during generation
  useEffect(() => {
    if (!isGenerating) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isGenerating]);

  // Intercept browser back/forward during generation
  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = isGenerating;

  const { confirm: confirmNavAway, ConfirmDialogPortal } = useConfirmDialog();
  const confirmNavAwayRef = useRef(confirmNavAway);
  confirmNavAwayRef.current = confirmNavAway;

  useEffect(() => {
    if (!isGenerating) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (!isGeneratingRef.current) return;
      window.history.pushState(null, '', window.location.href);
      confirmNavAwayRef.current({
        title: 'Leave page?',
        message: 'An AI generation is in progress. If you leave, the request will be cancelled.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        variant: 'warning',
      }).then((leave) => {
        if (leave) {
          abortRef.current?.abort();
          abortRef.current = null;
          window.history.back();
        }
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGenerating, abortRef]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, [abortRef]);

  return { ConfirmDialogPortal };
}
