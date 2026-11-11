import { useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { GraphQLOperation } from '../../../shared/types';
import { IconButton } from '../../components/controls';
import { toJson } from '../../utils/format';
import { TYPE_META } from './model';
import type { DetailTab } from './OperationDetails';

interface Hit {
  operation: GraphQLOperation;
  /** Occurrences in this source */
  count: number;
  tab: DetailTab;
  label: string;
  before: string;
  match: string;
  after: string;
}

const SOURCES: Array<{ tab: DetailTab; label: string; text: (op: GraphQLOperation) => string }> = [
  { tab: 'request', label: 'Query', text: (op) => op.query },
  { tab: 'request', label: 'Variables', text: (op) => (op.variables ? toJson(op.variables) : '') },
  { tab: 'response', label: 'Response', text: (op) => (op.data === undefined ? '' : JSON.stringify(op.data)) },
  { tab: 'headers', label: 'Headers', text: (op) => [...(op.request?.headers ?? []), ...(op.response?.headers ?? [])].map((h) => `${h.name}: ${h.value}`).join('\n') },
];

// ponytail: plain substring scan over every operation, add an index if sessions get huge
const findHits = (operations: GraphQLOperation[], query: string): Hit[] => {
  const needle = query.toLowerCase();
  return operations.flatMap((operation) =>
    SOURCES.flatMap(({ tab, label, text }) => {
      const haystack = text(operation);
      const at = haystack.toLowerCase().indexOf(needle);
      if (at < 0) return [];
      const lower = haystack.toLowerCase();
      let count = 0;
      for (let i = at; i >= 0; i = lower.indexOf(needle, i + needle.length)) count++;
      return [{
        operation,
        count,
        tab,
        label,
        before: (at > 14 ? '…' : '') + haystack.slice(Math.max(0, at - 14), at).replace(/\s+/g, ' '),
        match: haystack.slice(at, at + needle.length),
        after: haystack.slice(at + needle.length, at + needle.length + 40).replace(/\s+/g, ' '),
      }];
    }),
  );
};

interface Props {
  operations: GraphQLOperation[];
  query: string;
  onQueryChange: (query: string) => void;
  onOpen: (id: string, tab: DetailTab) => void;
  onClose: () => void;
  selectedId: string | null;
}

export function SearchPanel({ operations, query, onQueryChange, onOpen, onClose, selectedId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const hits = useMemo(() => (query.length > 1 ? findHits(operations, query) : []), [operations, query]);
  const perOperation = useMemo(() => {
    const counts = new Map<string, number>();
    hits.forEach(({ operation, count }) => counts.set(operation.id, (counts.get(operation.id) ?? 0) + count));
    return counts;
  }, [hits]);
  const total = [...perOperation.values()].reduce((sum, n) => sum + n, 0);

  return (
    <aside className="flex w-[288px] shrink-0 flex-col border-r border-border">
      <div className="flex h-[30px] shrink-0 items-center gap-1 border-b border-border bg-surface pl-2 pr-1">
        <span className="font-semibold">Search</span>
        <IconButton aria-label="Close search" onClick={onClose} className="ml-auto">
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div className="border-b border-border p-1.5">
        <input
          ref={inputRef}
          type="search"
          placeholder="Search queries, variables, responses"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Escape' && onClose()}
          className="h-[22px] w-full rounded border border-input bg-background px-2 outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {query.length > 1 && hits.length === 0 && <p className="p-3 text-muted-foreground">No matches</p>}
        {query.length <= 1 && <p className="p-3 text-muted-foreground">Type at least 2 characters.</p>}
        {hits.map((hit, index) => {
          const meta = TYPE_META[hit.operation.operationType];
          const first = index === 0 || hits[index - 1].operation.id !== hit.operation.id;
          return (
            <div key={`${hit.operation.id}-${hit.label}`}>
              {first && (
                <div className="flex items-center gap-2 px-2 pt-2 font-semibold">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] font-mono text-[10.5px] font-extrabold ${meta.badge}`}>
                    {meta.letter}
                  </span>
                  <span className="truncate">{hit.operation.operationName}</span>
                  <span className="ml-auto font-normal text-muted-foreground">{perOperation.get(hit.operation.id)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onOpen(hit.operation.id, hit.tab)}
                aria-current={selectedId === hit.operation.id || undefined}
                className="flex w-full items-baseline gap-2 py-0.5 pl-8 pr-2 text-left hover:bg-row-hover aria-[current]:bg-accent"
              >
                <span className="w-[62px] shrink-0 text-[11px] text-muted-foreground">{hit.label}</span>
                <span className="truncate font-mono text-[11px]">
                  {hit.before}
                  <mark className="rounded-sm bg-match text-foreground">{hit.match}</mark>
                  {hit.after}
                </span>
                {hit.count > 1 && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">+{hit.count - 1}</span>}
              </button>
            </div>
          );
        })}
      </div>
      {hits.length > 0 && (
        <div className="border-t border-border px-2 py-1 text-muted-foreground">
          {total} {total === 1 ? 'match' : 'matches'} in {perOperation.size} {perOperation.size === 1 ? 'operation' : 'operations'}
        </div>
      )}
    </aside>
  );
}
