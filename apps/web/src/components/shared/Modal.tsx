import { useEffect, useRef, useCallback, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'centered' | 'panel-right' | 'top-aligned';
  children: ReactNode;
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  variant = 'centered',
  children,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${useId()}`;

  const { handleFocusTrapKeyDown } = useFocusTrap(contentRef, isOpen);

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Backdrop click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const alignmentClass =
    variant === 'top-aligned'
      ? 'items-start justify-center pt-[15vh]'
      : variant === 'panel-right'
        ? 'items-center justify-end pr-4'
        : 'items-center justify-center';

  return createPortal(
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 flex ${alignmentClass} bg-black/40 dark:bg-black/60 p-4`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleFocusTrapKeyDown}
    >
      <div
        ref={contentRef}
        className={`bg-white dark:bg-slate-800 dark:text-slate-200 rounded-xl shadow-xl w-full ${SIZE_MAP[size]} flex flex-col max-h-[85vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <span id={titleId} className="sr-only">{title}</span>
        {children}
      </div>
    </div>,
    document.body
  );
}
