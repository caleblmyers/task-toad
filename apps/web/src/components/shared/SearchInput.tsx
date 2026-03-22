import { forwardRef, useState, useRef, useEffect, useMemo } from 'react';
import { IconSearch, IconClose } from './Icons';
import { isTQLQuery } from '../../utils/tqlHelpers';
import type { SavedFilter } from './FilterBar';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  tqlError?: string | null;
  savedFilters?: SavedFilter[];
  onSaveQuery?: (name: string, tql: string) => void;
  onDeleteFilter?: (filterId: string) => void;
  onUpdateFilter?: (filterId: string, name: string) => void;
}

const TQL_HELP_CONTENT = [
  { syntax: 'status:done', desc: 'Filter by field value' },
  { syntax: 'priority:high,critical', desc: 'Multiple values (OR)' },
  { syntax: '-status:done', desc: 'Negation (exclude)' },
  { syntax: 'storyPoints>5', desc: 'Comparison (>, <, >=, <=)' },
  { syntax: 'assignee:"John Smith"', desc: 'Quoted values' },
  { syntax: '(a OR b) AND c', desc: 'Grouping with AND/OR' },
  { syntax: 'fix login bug', desc: 'Free text search' },
];

const VALID_FIELDS = ['status', 'priority', 'assignee', 'label', 'taskType', 'dueDate', 'estimatedHours', 'storyPoints', 'sprintId'];

const VALUE_SUGGESTIONS: Record<string, string[]> = {
  status: ['todo', 'in_progress', 'in_review', 'done'],
  priority: ['low', 'medium', 'high', 'critical'],
  taskType: ['task', 'bug', 'story', 'epic'],
};

/** Detect if cursor is after `fieldName:partialValue` and return the field + partial */
function getValueContext(value: string, cursorPos: number): { field: string; partial: string; start: number } | null {
  const before = value.slice(0, cursorPos);
  const match = before.match(/(?:^|\s)([a-zA-Z]+):([a-zA-Z_]*)$/);
  if (!match) return null;
  const field = match[1];
  if (!(field in VALUE_SUGGESTIONS)) return null;
  return { field, partial: match[2], start: before.length - match[2].length };
}

function TQLHelpPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg p-3 text-xs"
    >
      <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">TQL Syntax Reference</div>
      <table className="w-full">
        <tbody>
          {TQL_HELP_CONTENT.map((item) => (
            <tr key={item.syntax}>
              <td className="py-0.5 pr-2 font-mono text-brand-green dark:text-green-400 whitespace-nowrap">{item.syntax}</td>
              <td className="py-0.5 text-slate-500 dark:text-slate-400">{item.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500">
        Fields: {VALID_FIELDS.join(', ')}
      </div>
    </div>
  );
}

/** Extract the word fragment immediately before the cursor that has no `:` yet */
function getWordBeforeCursor(value: string, cursorPos: number): string {
  const before = value.slice(0, cursorPos);
  const match = before.match(/(?:^|\s)([a-zA-Z]+)$/);
  return match ? match[1] : '';
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Search or type TQL (e.g., status:done)', className = '', tqlError, savedFilters, onSaveQuery, onDeleteFilter, onUpdateFilter }, ref) => {
    const [showHelp, setShowHelp] = useState(false);
    const [cursorPos, setCursorPos] = useState(0);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [showSavedDropdown, setShowSavedDropdown] = useState(false);
    const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
    const [editFilterName, setEditFilterName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const autocompleteRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const isTQL = isTQLQuery(value);

    // Merge forwarded ref with local ref
    const setRefs = (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
    };

    // TQL autocomplete suggestions
    const wordBeforeCursor = getWordBeforeCursor(value, cursorPos);
    const valueContext = useMemo(() => getValueContext(value, cursorPos), [value, cursorPos]);
    const fieldSuggestions = useMemo(() => {
      if (valueContext) return []; // Don't show field suggestions when in value context
      if (!wordBeforeCursor || wordBeforeCursor.length < 1) return [];
      const lower = wordBeforeCursor.toLowerCase();
      return VALID_FIELDS.filter((f) => f.toLowerCase().startsWith(lower) && f.toLowerCase() !== lower);
    }, [wordBeforeCursor, valueContext]);
    const valueSuggestions = useMemo(() => {
      if (!valueContext) return [];
      const values = VALUE_SUGGESTIONS[valueContext.field] ?? [];
      if (!valueContext.partial) return values;
      const lower = valueContext.partial.toLowerCase();
      return values.filter((v) => v.toLowerCase().startsWith(lower) && v.toLowerCase() !== lower);
    }, [valueContext]);
    const suggestions = fieldSuggestions.length > 0 ? fieldSuggestions : valueSuggestions;
    const isValueMode = fieldSuggestions.length === 0 && valueSuggestions.length > 0;

    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const showAutocomplete = suggestions.length > 0;

    // Close autocomplete on outside click
    useEffect(() => {
      if (!showAutocomplete) return;
      const handler = (e: MouseEvent) => {
        if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
          // no-op — suggestions will hide when word changes
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [showAutocomplete]);

    const handleSelectValue = (val: string) => {
      if (!valueContext) return;
      const before = value.slice(0, valueContext.start);
      const after = value.slice(cursorPos);
      const newValue = before + val + after;
      onChange(newValue);
      const newPos = valueContext.start + val.length;
      setCursorPos(newPos);
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(newPos, newPos);
        inputRef.current?.focus();
      });
    };

    const handleSelectField = (field: string) => {
      // Replace the partial word before cursor with the full field name + ':'
      const before = value.slice(0, cursorPos);
      const after = value.slice(cursorPos);
      const match = before.match(/(?:^|\s)([a-zA-Z]+)$/);
      if (match) {
        const start = before.length - match[1].length;
        const newValue = before.slice(0, start) + field + ':' + after;
        onChange(newValue);
        // Set cursor after the colon
        const newPos = start + field.length + 1;
        setCursorPos(newPos);
        requestAnimationFrame(() => {
          inputRef.current?.setSelectionRange(newPos, newPos);
          inputRef.current?.focus();
        });
      }
    };

    const handleSave = () => {
      if (saveName.trim() && onSaveQuery && value.trim()) {
        onSaveQuery(saveName.trim(), value.trim());
        setSaveName('');
        setShowSaveDialog(false);
      }
    };

    const tqlSavedFilters = savedFilters?.filter((f) => f.viewType === 'tql') ?? [];

    return (
      <div className={`relative ${className}`}>
        <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          ref={setRefs}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursorPos(e.target.selectionStart ?? e.target.value.length);
            setHighlightedIndex(-1);
          }}
          onKeyDown={(e) => {
            if (showAutocomplete) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
              } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                if (isValueMode) handleSelectValue(suggestions[highlightedIndex]);
                else handleSelectField(suggestions[highlightedIndex]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setHighlightedIndex(-1);
                // Clear autocomplete by blurring focus momentarily
                inputRef.current?.blur();
                inputRef.current?.focus();
              }
            }
          }}
          onKeyUp={(e) => setCursorPos((e.target as HTMLInputElement).selectionStart ?? cursorPos)}
          onClick={(e) => setCursorPos((e.target as HTMLInputElement).selectionStart ?? cursorPos)}
          placeholder={placeholder}
          className={`w-full pl-8 pr-20 py-1.5 text-sm border rounded-md bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-green focus:border-brand-green ${
            tqlError
              ? 'border-red-400 dark:border-red-500'
              : 'border-slate-200 dark:border-slate-600'
          } ${isTQL ? 'font-mono text-xs' : ''}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isTQL && onSaveQuery && value.trim() && (
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              className="text-slate-400 hover:text-brand-green dark:hover:text-green-400 p-0.5"
              aria-label="Save TQL query"
              title="Save query"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 2h10v12l-5-3-5 3V2z" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {tqlSavedFilters.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSavedDropdown((v) => !v)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[10px] px-1"
              aria-label="Saved TQL queries"
              title="Saved queries"
            >
              Saved
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Clear search"
            >
              <IconClose className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-xs w-4 h-4 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-500"
            aria-label="TQL syntax help"
          >
            ?
          </button>
        </div>

        {/* TQL field/value autocomplete dropdown */}
        {showAutocomplete && (
          <div
            ref={autocompleteRef}
            className="absolute top-full left-0 mt-0.5 z-50 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg overflow-hidden"
          >
            {isValueMode && (
              <div className="px-3 py-1 text-[10px] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
                {valueContext?.field} values
              </div>
            )}
            {suggestions.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => isValueMode ? handleSelectValue(item) : handleSelectField(item)}
                className={`w-full text-left text-xs px-3 py-1.5 text-slate-700 dark:text-slate-300 font-mono ${
                  index === highlightedIndex
                    ? 'bg-slate-100 dark:bg-slate-700'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {isValueMode ? item : <>{item}<span className="text-slate-400">:</span></>}
              </button>
            ))}
          </div>
        )}

        {/* Saved TQL queries dropdown */}
        {showSavedDropdown && tqlSavedFilters.length > 0 && (
          <div className="absolute top-full right-0 mt-0.5 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg overflow-hidden">
            <div className="px-2 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
              Saved Queries
            </div>
            {tqlSavedFilters.map((sf) => {
              const tql = (() => { try { const p = JSON.parse(sf.filters); return typeof p === 'string' ? p : (p.tql ?? sf.filters); } catch { return sf.filters; } })();
              const isEditing = editingFilterId === sf.savedFilterId;
              const isConfirmingDelete = confirmDeleteId === sf.savedFilterId;

              if (isConfirmingDelete) {
                return (
                  <div key={sf.savedFilterId} className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-1.5">Delete &ldquo;{sf.name}&rdquo;?</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteFilter?.(sf.savedFilterId); setConfirmDeleteId(null); }}
                        className="text-[10px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="text-[10px] px-2 py-0.5 text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              if (isEditing) {
                return (
                  <div key={sf.savedFilterId} className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700">
                    <input
                      type="text"
                      value={editFilterName}
                      onChange={(e) => setEditFilterName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editFilterName.trim()) {
                          onUpdateFilter?.(sf.savedFilterId, editFilterName.trim());
                          setEditingFilterId(null);
                        }
                        if (e.key === 'Escape') setEditingFilterId(null);
                      }}
                      className="w-full text-xs px-1.5 py-0.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-green"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={sf.savedFilterId}
                  className="flex items-center group hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onChange(tql);
                      setShowSavedDropdown(false);
                    }}
                    className="flex-1 text-left text-xs px-3 py-1.5 text-slate-700 dark:text-slate-300 min-w-0"
                  >
                    <div
                      className="font-medium truncate cursor-pointer"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (onUpdateFilter) {
                          setEditingFilterId(sf.savedFilterId);
                          setEditFilterName(sf.name);
                        }
                      }}
                      title="Double-click to rename"
                    >
                      {sf.name}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">{tql}</div>
                  </button>
                  {onDeleteFilter && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(sf.savedFilterId); }}
                      className="px-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      aria-label={`Delete query "${sf.name}"`}
                      title="Delete"
                    >
                      <IconClose className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Save TQL query dialog */}
        {showSaveDialog && (
          <div className="absolute top-full left-0 mt-0.5 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg p-3">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200 mb-2">Save TQL Query</div>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveDialog(false); }}
              placeholder="Query name..."
              className="w-full text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-slate-200 mb-2 focus:outline-none focus:ring-1 focus:ring-brand-green"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="text-xs px-2 py-1 bg-brand-green text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveDialog(false); setSaveName(''); }}
                className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showHelp && <TQLHelpPopover onClose={() => setShowHelp(false)} />}
        {tqlError && !showAutocomplete && (
          <div className="absolute top-full left-0 mt-0.5 text-xs text-red-500 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded px-2 py-1 shadow-sm z-40 max-w-full truncate">
            {tqlError}
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
