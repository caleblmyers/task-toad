import type { Toast } from '../../hooks/useToast';

const typeStyles: Record<Toast['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-slate-700',
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${typeStyles[toast.type]} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in min-w-[200px]`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
