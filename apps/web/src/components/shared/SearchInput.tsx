import { forwardRef } from 'react';
import { IconSearch, IconClose } from './Icons';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Search...', className = '' }, ref) => {
    return (
      <div className={`relative ${className}`}>
        <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <IconClose className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
