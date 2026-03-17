import { useState } from 'react';
import Modal from './shared/Modal';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBase: string | null;
  onSave: (kb: string) => void;
}

export default function KnowledgeBaseModal({ isOpen, onClose, knowledgeBase, onSave }: KnowledgeBaseModalProps) {
  const [value, setValue] = useState(knowledgeBase ?? '');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Project Knowledge Base" size="md">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">Project Knowledge Base</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          This context is injected into all AI prompts for this project.
        </p>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green resize-y"
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
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(value); onClose(); }}
            className="px-4 py-2 text-sm text-white bg-slate-700 dark:bg-slate-600 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-500"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
