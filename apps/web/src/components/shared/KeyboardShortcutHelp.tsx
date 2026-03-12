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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-80 p-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
            &times;
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{s.description}</span>
              <kbd className="text-xs bg-slate-100 border border-slate-200 rounded px-2 py-0.5 font-mono text-slate-600">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
