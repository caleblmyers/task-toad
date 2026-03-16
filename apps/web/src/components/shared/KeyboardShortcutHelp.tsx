import Modal from './Modal';

interface KeyboardShortcutHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { key: 'j', description: 'Next task' },
  { key: 'k', description: 'Previous task' },
  { key: 'Enter', description: 'Open task' },
  { key: 'Esc', description: 'Close panel / deselect' },
  { key: 'n', description: 'New task' },
  { key: '/', description: 'Focus search' },
  { key: '?', description: 'Show shortcuts' },
];

export default function KeyboardShortcutHelp({ onClose }: KeyboardShortcutHelpProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Keyboard Shortcuts" size="sm">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">{s.description}</span>
              <kbd className="text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-0.5 font-mono text-slate-600 dark:text-slate-300">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
