import { useRef, useEffect, useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-focus cancel button (safe default)
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="p-6">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 pb-6">
        <Button ref={cancelRef} variant="secondary" size="md" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="md" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// Ergonomic hook for imperative usage
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

interface UseConfirmDialogReturn {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  ConfirmDialogPortal: () => JSX.Element | null;
}

export function useConfirmDialog(): UseConfirmDialogReturn {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const ConfirmDialogPortal = useCallback(() => {
    if (!state) return null;
    return (
      <ConfirmDialog
        isOpen={true}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }, [state, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialogPortal };
}
