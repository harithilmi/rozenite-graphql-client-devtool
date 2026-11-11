import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useActions, useIsRecording, useOperations, useSelectedOperationId } from '../store/hooks';
import { cn } from '../utils/cn';
import { formatBytes } from '../utils/format';
import { OperationsToolbar } from './operations/OperationsToolbar';
import { OperationsTable } from './operations/OperationsTable';
import { OperationDetails, type DetailTab } from './operations/OperationDetails';
import { SearchPanel } from './operations/SearchPanel';
import { errorCount, filterOperations, isFailed, initialFilter, OPERATION_TYPES, TYPE_META, type OperationFilter } from './operations/model';

const MIN_LIST_WIDTH = 160;

function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint: ReactNode }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-1.5">
      {icon}
      <div className="font-semibold text-foreground">{title}</div>
      <div className="text-muted-foreground">{hint}</div>
    </div>
  );
}

export function OperationsTab() {
  const operations = useOperations();
  const selectedId = useSelectedOperationId();
  const isRecording = useIsRecording();
  const { setSelectedOperation, clearOperations, setRecording } = useActions();

  const [filter, setFilter] = useState<OperationFilter>(initialFilter);
  const [detailTab, setDetailTab] = useState<DetailTab>('request');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [listWidth, setListWidth] = useState(260);
  const splitRef = useRef<HTMLDivElement>(null);

  // Oldest first, like the Network panel
  const all = useMemo(() => [...operations.values()].sort((a, b) => a.timestamp - b.timestamp), [operations]);
  const { rows, match, error: filterError } = useMemo(() => filterOperations(all, filter), [all, filter]);
  const selected = selectedId ? operations.get(selectedId) : undefined;

  const totals = useMemo(
    () => ({
      failed: rows.filter(isFailed).length,
      errors: rows.filter((op) => !isFailed(op) && errorCount(op) > 0).length,
      bytes: rows.reduce((sum, op) => sum + (op.response?.size ?? 0), 0),
    }),
    [rows],
  );

  // ⌘/Ctrl+F opens search, Esc closes the details pane
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement)) setSelectedOperation(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelectedOperation]);

  const startResize = (event: React.PointerEvent) => {
    const left = splitRef.current?.getBoundingClientRect().left ?? 0;
    const max = (splitRef.current?.clientWidth ?? 800) - 240;
    const onMove = (move: PointerEvent) =>
      setListWidth(Math.min(max, Math.max(MIN_LIST_WIDTH, move.clientX - left)));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    event.preventDefault();
  };

  const empty = filterError ? (
    <EmptyState title="Invalid regular expression" hint={filterError} />
  ) : all.length === 0 ? (
    <EmptyState
      icon={<span className={cn('h-2.5 w-2.5 rounded-full', isRecording ? 'animate-pulse bg-destructive' : 'border-2 border-muted-foreground')} />}
      title={isRecording ? 'Recording GraphQL operations' : 'Recording is paused'}
      hint={isRecording ? 'Use your app: queries, mutations and subscriptions show up here.' : 'Press the record button to capture operations.'}
    />
  ) : (
    <EmptyState
      title={filter.text ? `No operations match “${filter.text}”` : 'All operation types are hidden'}
      hint={
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => setFilter({ ...initialFilter, isRegex: filter.isRegex })}
        >
          Clear filters
        </button>
      }
    />
  );

  return (
    <div className="flex h-full flex-col">
      <OperationsToolbar
        filter={filter}
        onFilterChange={setFilter}
        filterError={filterError}
        isRecording={isRecording}
        onToggleRecording={() => setRecording(!isRecording)}
        onClear={clearOperations}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setSearchOpen(!isSearchOpen)}
      />

      <div ref={splitRef} className="flex min-h-0 flex-1">
        {isSearchOpen && (
          <SearchPanel
            operations={all}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onOpen={(id, tab) => {
              setSelectedOperation(id);
              setDetailTab(tab);
            }}
            onClose={() => setSearchOpen(false)}
            selectedId={selectedId}
          />
        )}

        <div className="flex min-w-0 flex-col" style={selected ? { width: listWidth, flex: 'none' } : { flex: 1 }}>
          <OperationsTable
            rows={rows}
            selectedId={selectedId}
            onSelect={setSelectedOperation}
            compact={Boolean(selected)}
            match={match}
            empty={empty}
          />
        </div>

        {selected && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startResize}
              className="w-px shrink-0 cursor-col-resize bg-border outline outline-4 outline-transparent hover:bg-primary"
            />
            <OperationDetails
              operation={selected}
              tab={detailTab}
              onTabChange={setDetailTab}
              onClose={() => setSelectedOperation(null)}
              searchTerm={isSearchOpen && searchQuery.length > 1 ? searchQuery : undefined}
            />
          </>
        )}
      </div>

      <div className="flex h-[26px] shrink-0 items-center gap-1 border-t border-border bg-surface px-1.5">
        {OPERATION_TYPES.map((type) => {
          const meta = TYPE_META[type];
          const on = filter.types[type];
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter({ ...filter, types: { ...filter.types, [type]: !on } })}
              title={`${on ? 'Hide' : 'Show'} ${meta.label.toLowerCase()}`}
              className={cn(
                'inline-flex h-5 items-center gap-1.5 rounded-full px-2',
                on
                  ? cn(meta.chip, 'font-medium ring-1 ring-inset hover:brightness-95')
                  : 'text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', on ? meta.dot : 'border border-muted-foreground')} />
              {meta.label}
            </button>
          );
        })}
        <span className="ml-auto truncate pl-2 text-muted-foreground">
          {rows.length === all.length ? `${all.length} operations` : `${rows.length} / ${all.length} operations`}
          {totals.failed > 0 && <span className="text-destructive"> · {totals.failed} failed</span>}
          {totals.errors > 0 && <span className="text-warning"> · {totals.errors} with GraphQL errors</span>}
          {' · '}
          {formatBytes(totals.bytes)} received
        </span>
      </div>
    </div>
  );
}
