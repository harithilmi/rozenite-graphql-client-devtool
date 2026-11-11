import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Ban, RefreshCw } from 'lucide-react';
import type { CacheWrite } from '../../shared/types';
import { CopyButton, Divider, IconButton } from '../components/controls';
import { JsonView } from '../components/JsonView';
import { useActions, useCacheEntries, useCacheWrites, useIsRecordingCacheWrites } from '../store/hooks';
import { cn } from '../utils/cn';
import { formatClock, toJson } from '../utils/format';

const ROOTS = ['ROOT_QUERY', 'ROOT_MUTATION', 'ROOT_SUBSCRIPTION'];

/** Root objects first, then by ID */
const byCacheId = (a: string, b: string) => {
  const ra = ROOTS.indexOf(a);
  const rb = ROOTS.indexOf(b);
  if (ra !== rb) return (ra < 0 ? ROOTS.length : ra) - (rb < 0 ? ROOTS.length : rb);
  return a.localeCompare(b, undefined, { numeric: true });
};

/** Selected cache ID with back/forward history, so following __ref links can be undone */
function useHistory() {
  const [stack, setStack] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);
  return {
    current: stack[index] ?? null,
    canBack: index > 0,
    canForward: index < stack.length - 1,
    go: (id: string) => {
      if (stack[index] === id) return;
      setStack([...stack.slice(0, index + 1), id]);
      setIndex(index + 1);
    },
    back: () => setIndex(Math.max(0, index - 1)),
    forward: () => setIndex(Math.min(stack.length - 1, index + 1)),
  };
}

function WriteRow({ write, open, onToggle, onOpenId }: { write: CacheWrite; open: boolean; onToggle: () => void; onOpenId: (id: string) => void }) {
  return (
    <li className="border-b border-border">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left hover:bg-muted">
        <span className="flex w-full items-baseline gap-2">
          <span className="truncate font-medium">{write.documentName ?? '(anonymous)'}</span>
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{formatClock(write.timestamp)}</span>
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">→ {write.dataId}</span>
      </button>
      {open && (
        <div className="space-y-1 px-2 pb-2">
          <button type="button" onClick={() => onOpenId(write.dataId)} className="text-primary hover:underline">
            Open {write.dataId}
          </button>
          {write.variables && Object.keys(write.variables).length > 0 && <JsonView name="variables" value={write.variables} openDepth={1} />}
          {write.result === undefined ? (
            <p className="text-muted-foreground">Result hidden (includeResponseData is off)</p>
          ) : (
            <JsonView name="result" value={write.result} openDepth={2} />
          )}
        </div>
      )}
    </li>
  );
}

export function CacheTab() {
  const entries = useCacheEntries();
  const writes = useCacheWrites();
  const isRecordingWrites = useIsRecordingCacheWrites();
  const { requestCacheSnapshot, setRecordingCacheWrites, clearCacheWrites } = useActions();
  const [search, setSearch] = useState('');
  const [openWrite, setOpenWrite] = useState<string | null>(null);
  const history = useHistory();

  const ids = useMemo(() => [...entries.keys()].sort(byCacheId), [entries]);
  const shown = useMemo(() => {
    const needle = search.toLowerCase();
    return needle ? ids.filter((id) => id.toLowerCase().includes(needle)) : ids;
  }, [ids, search]);

  const selectedId = history.current ?? (ids.includes('ROOT_QUERY') ? 'ROOT_QUERY' : ids[0] ?? null);
  const selected = selectedId ? entries.get(selectedId) : undefined;
  const openId = (id: string) => history.go(id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[30px] shrink-0 items-center gap-1 border-b border-border bg-surface px-1.5">
        <IconButton aria-label="Refresh cache" title="Refresh (the cache also updates on every write)" onClick={requestCacheSnapshot}>
          <RefreshCw className="h-3.5 w-3.5" />
        </IconButton>
        <Divider />
        <input
          type="search"
          aria-label="Filter cache IDs"
          placeholder="Filter cache IDs"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="h-[22px] w-64 rounded border border-input bg-background px-2 outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        <span className="ml-2 text-muted-foreground">
          {shown.length === ids.length ? `${ids.length} objects` : `${shown.length} / ${ids.length} objects`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Cache IDs */}
        <ul aria-label="Cache IDs" className="w-60 shrink-0 overflow-auto border-r border-border">
          {shown.map((id, index) => (
            <li key={id}>
              <button
                type="button"
                aria-current={id === selectedId || undefined}
                onClick={() => openId(id)}
                className={cn(
                  'block h-[22px] w-full truncate px-2 text-left font-mono text-[11.5px]',
                  id === selectedId
                    ? 'bg-selected text-selected-foreground'
                    : cn(index % 2 ? 'bg-row-alt' : 'bg-background', 'hover:bg-row-hover', ROOTS.includes(id) && 'font-semibold'),
                )}
              >
                {id}
              </button>
            </li>
          ))}
          {ids.length > 0 && shown.length === 0 && <li className="p-3 text-muted-foreground">No IDs match “{search}”</li>}
        </ul>

        {/* Selected entry */}
        <section className="flex min-w-0 flex-1 flex-col">
          {selected && selectedId ? (
            <>
              <div className="flex h-[30px] shrink-0 items-center gap-1 border-b border-border px-1.5">
                <IconButton aria-label="Back" disabled={!history.canBack} onClick={history.back}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton aria-label="Forward" disabled={!history.canForward} onClick={history.forward}>
                  <ArrowRight className="h-3.5 w-3.5" />
                </IconButton>
                <span className="ml-1 truncate font-mono font-semibold">{selectedId}</span>
                {selected.typename && <span className="shrink-0 text-muted-foreground">{selected.typename}</span>}
                <span className="ml-auto flex gap-1.5">
                  <CopyButton text={selectedId}>Copy ID</CopyButton>
                  <CopyButton text={toJson(selected.data)}>Copy JSON</CopyButton>
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <JsonView value={selected.data} openDepth={2} hideRoot onRef={openId} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
              <div className="font-semibold">{ids.length ? 'Select a cache ID' : 'The cache is empty'}</div>
              <div className="text-muted-foreground">
                {ids.length ? 'References like Book:1 are links: click to follow them.' : 'Run a query in your app; results land here as they are written.'}
              </div>
            </div>
          )}
        </section>

        {/* Cache writes */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-border">
          <div className="flex h-[30px] shrink-0 items-center gap-1 border-b border-border bg-surface pl-2 pr-1">
            <span className="font-semibold">Cache writes ({writes.length})</span>
            <IconButton
              className="ml-auto"
              aria-label={isRecordingWrites ? 'Pause cache write log' : 'Record cache writes'}
              title={isRecordingWrites ? 'Pause' : 'Record'}
              onClick={() => setRecordingCacheWrites(!isRecordingWrites)}
            >
              <span className={cn('h-3 w-3 rounded-full border-2', isRecordingWrites ? 'border-destructive bg-destructive' : 'border-muted-foreground')} />
            </IconButton>
            <IconButton aria-label="Clear cache writes" title="Clear" onClick={clearCacheWrites}>
              <Ban className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto">
            {writes.map((write) => (
              <WriteRow
                key={write.id}
                write={write}
                open={openWrite === write.id}
                onToggle={() => setOpenWrite(openWrite === write.id ? null : write.id)}
                onOpenId={openId}
              />
            ))}
            {writes.length === 0 && (
              <li className="p-3 text-muted-foreground">
                {isRecordingWrites ? 'Writes show up here as queries, mutations and cache updates land.' : 'Paused.'}
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
