import { useState } from 'react';

export interface MultiPickerProps<T> {
  items: T[];
  selectedIds: string[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
  emptyText?: string;
  allSelectedText?: string;
  tagClassName?: string;
  renderTag?: (item: T, onRemove: () => void) => React.ReactNode;
  renderItem?: (item: T) => React.ReactNode;
  extraContent?: React.ReactNode;
  children?: React.ReactNode;
}

export default function MultiPicker<T>({
  items,
  selectedIds,
  getId,
  getLabel,
  onAdd,
  onRemove,
  placeholder,
  disabled,
  emptyText = 'None',
  allSelectedText = 'All selected',
  tagClassName = 'bg-blue-50 text-blue-700 border-blue-200',
  renderTag,
  renderItem,
  extraContent,
  children,
}: MultiPickerProps<T>) {
  const [showPicker, setShowPicker] = useState(false);

  const selectedItems = items.filter((item) => selectedIds.includes(getId(item)));
  const availableItems = items.filter((item) => !selectedIds.includes(getId(item)));

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {selectedItems.length > 0
          ? selectedItems.map((item) => {
              const id = getId(item);
              if (renderTag) {
                return <span key={id}>{renderTag(item, () => onRemove(id))}</span>;
              }
              return (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${tagClassName}`}
                >
                  {getLabel(item)}
                  <button
                    onClick={() => onRemove(id)}
                    className="ml-0.5 hover:opacity-70"
                    disabled={disabled}
                    aria-label={`Remove ${getLabel(item)}`}
                  >
                    ✕
                  </button>
                </span>
              );
            })
          : <span className="text-xs text-slate-400">{emptyText}</span>
        }
      </div>
      {children}
      {showPicker ? (
        <div className="mt-1">
          <div className="max-h-32 overflow-y-auto border border-slate-200 rounded mb-1">
            {availableItems.length > 0
              ? availableItems.map((item) => (
                  <button
                    key={getId(item)}
                    onClick={() => {
                      onAdd(getId(item));
                      setShowPicker(false);
                    }}
                    className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    disabled={disabled}
                  >
                    {renderItem ? renderItem(item) : getLabel(item)}
                  </button>
                ))
              : <p className="text-xs text-slate-400 px-2 py-1">{allSelectedText}</p>
            }
          </div>
          {extraContent}
          <button onClick={() => setShowPicker(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="text-xs text-slate-500 hover:text-slate-700"
          disabled={disabled}
        >
          {placeholder}
        </button>
      )}
    </>
  );
}
