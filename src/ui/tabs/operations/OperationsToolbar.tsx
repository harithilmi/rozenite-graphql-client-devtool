import { Ban, Search } from 'lucide-react';
import { Checkbox, Divider, IconButton } from '../../components/controls';
import { cn } from '../../utils/cn';
import type { OperationFilter } from './model';

interface Props {
  filter: OperationFilter;
  onFilterChange: (filter: OperationFilter) => void;
  filterError?: string;
  isRecording: boolean;
  onToggleRecording: () => void;
  onClear: () => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
}

export function OperationsToolbar({
  filter,
  onFilterChange,
  filterError,
  isRecording,
  onToggleRecording,
  onClear,
  isSearchOpen,
  onToggleSearch,
}: Props) {
  const set = (patch: Partial<OperationFilter>) => onFilterChange({ ...filter, ...patch });

  return (
    <div className="flex h-[30px] shrink-0 items-center gap-1 border-b border-border bg-surface px-1.5">
      <IconButton
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        title={isRecording ? 'Stop recording' : 'Record operations'}
        onClick={onToggleRecording}
      >
        <span
          className={cn(
            'h-3 w-3 rounded-full border-2',
            isRecording ? 'border-destructive bg-destructive' : 'border-muted-foreground',
          )}
        />
      </IconButton>
      <IconButton aria-label="Clear" title="Clear operations" onClick={onClear}>
        <Ban className="h-3.5 w-3.5" />
      </IconButton>
      <Divider />
      <input
        type="search"
        aria-label="Filter by operation name"
        placeholder={filter.isRegex ? '/ab+c/' : 'Filter'}
        value={filter.text}
        onChange={(event) => set({ text: event.currentTarget.value })}
        className={cn(
          'h-[22px] w-64 rounded border bg-background px-2 text-foreground outline-none placeholder:text-muted-foreground',
          'focus:border-ring',
          filterError ? 'border-destructive' : 'border-input',
        )}
        title={filterError}
      />
      <div className="ml-2 flex items-center gap-3">
        <Checkbox label="Invert" checked={filter.isInverted} onChange={(isInverted) => set({ isInverted })} />
        <Checkbox label="Regex" checked={filter.isRegex} onChange={(isRegex) => set({ isRegex })} />
      </div>
      <Divider />
      <IconButton active={isSearchOpen} onClick={onToggleSearch} title="Search all requests and responses (⌘/Ctrl+F)" className="px-1.5">
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
      </IconButton>
    </div>
  );
}
