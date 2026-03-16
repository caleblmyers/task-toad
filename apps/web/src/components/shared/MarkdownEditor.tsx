import { useState, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  rows?: number;
}

export default function MarkdownEditor({ value, onChange, onSave, onCancel, placeholder, rows = 6 }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const newText = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const newText = value.slice(0, start) + text + value.slice(start);
    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const btnClass = 'px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded font-mono';

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-slate-50 border-b border-slate-200">
        <button type="button" onClick={() => wrapSelection('**', '**')} className={btnClass} title="Bold">B</button>
        <button type="button" onClick={() => wrapSelection('*', '*')} className={`${btnClass} italic`} title="Italic">I</button>
        <button type="button" onClick={() => wrapSelection('`', '`')} className={btnClass} title="Code">&lt;/&gt;</button>
        <button type="button" onClick={() => insertAtCursor('\n- ')} className={btnClass} title="List">List</button>
        <button type="button" onClick={() => wrapSelection('[', '](url)')} className={btnClass} title="Link">Link</button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className={`text-xs px-2 py-0.5 rounded ${showPreview ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {showPreview ? (
        <div className="p-3 min-h-[100px]">
          {value ? <MarkdownRenderer content={value} /> : <p className="text-xs text-slate-400">Nothing to preview</p>}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 text-sm text-slate-700 focus:outline-none resize-y"
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 border-t border-slate-200">
        <span className="text-[10px] text-slate-400">Markdown supported</span>
        <div className="flex gap-1">
          <button type="button" onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5">Cancel</button>
          <button type="button" onClick={onSave} className="text-xs bg-brand-green text-white px-3 py-0.5 rounded hover:bg-brand-green-hover">Save</button>
        </div>
      </div>
    </div>
  );
}
