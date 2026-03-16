import { useState } from 'react';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBase: string | null;
  onSave: (kb: string) => void;
}

export default function KnowledgeBaseModal({ isOpen, onClose, knowledgeBase, onSave }: KnowledgeBaseModalProps) {
  const [value, setValue] = useState(knowledgeBase ?? '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Project Knowledge Base</h2>
        <p className="text-xs text-slate-500 mb-4">
          This context is injected into all AI prompts for this project.
        </p>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"
          placeholder="Describe tech stack, coding conventions, architecture, etc. This is injected into all AI prompts for this project."
        />

        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs ${value.length > 800 ? 'text-amber-600' : 'text-slate-400'}`}>
            {value.length} chars{value.length > 800 ? ' (> 800 recommended limit)' : ' — < 800 chars recommended'}
          </span>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(value); onClose(); }}
            className="px-4 py-2 text-sm text-white bg-slate-700 rounded-lg hover:bg-slate-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
