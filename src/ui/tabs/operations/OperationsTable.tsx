import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GraphQLOperation } from '../../../shared/types';
import { cn } from '../../utils/cn';
import { formatBytes, formatDuration } from '../../utils/format';
import { errorCount, getStatus, isFailed, isPending, TONE_DOT, TYPE_META, type NameMatcher, type StatusTone } from './model';
import type { ReactNode } from 'react';

const TONE_TEXT: Record<StatusTone, string> = {
  pending: 'text-muted-foreground',
  error: 'text-destructive',
  warning: '',
  success: '',
};

// Name | Status | Size | Time | URL
const FULL_GRID = 'grid-cols-[minmax(180px,2fr)_96px_80px_80px_minmax(140px,3fr)]';

interface Props {
  rows: GraphQLOperation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Only the name column (used when the details pane is open) */
  compact: boolean;
  match?: NameMatcher;
  empty: ReactNode;
}

function Highlighted({ text, match }: { text: string; match?: NameMatcher }) {
  const range = match?.(text);
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-match text-foreground">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

/** Ticking "1.20 s…" for operations still in flight */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  return <>{formatDuration(Math.max(0, now - since))}</>;
}

function NameCell({ operation, selected, match, compact }: { operation: GraphQLOperation; selected: boolean; match?: NameMatcher; compact: boolean }) {
  const meta = TYPE_META[operation.operationType];
  const errors = errorCount(operation);
  // Red = the request failed. Amber = it worked but the GraphQL response has errors
  const failed = isFailed(operation);
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <span
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] font-mono text-[10.5px] font-extrabold',
          selected ? 'bg-white/25 text-selected-foreground' : meta.badge,
        )}
        title={operation.operationType}
      >
        {meta.letter}
      </span>
      <span className={cn('truncate font-medium', failed && !selected && 'text-destructive')}>
        <Highlighted text={operation.operationName} match={match} />
      </span>
      {/* One fixed slot at the right edge so badges line up */}
      {(errors > 0 || (compact && isPending(operation))) && (
        <span className="ml-auto flex w-5 shrink-0 justify-center">
          {errors > 0 ? (
            <span
              className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
                failed ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-background',
                selected && 'ring-1 ring-selected-foreground',
              )}
              title={operation.errors?.map((e) => e.message).join('\n') ?? operation.error?.message}
            >
              {errors}
            </span>
          ) : (
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" title="Pending" />
          )}
        </span>
      )}
    </div>
  );
}

export function OperationsTable({ rows, selectedId, onSelect, compact, match, empty }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Like DevTools Network: newest at the bottom, follow new rows while scrolled to the end
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  // ↑/↓ moves the selection (ignored while typing)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return;
      const index = rows.findIndex((row) => row.id === selectedId);
      const next = rows[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (!next) return;
      event.preventDefault();
      onSelect(next.id);
      requestAnimationFrame(() =>
        scrollRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }),
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, selectedId, onSelect]);

  const grid = compact ? 'grid-cols-[minmax(0,1fr)]' : FULL_GRID;
  const cell = 'flex h-[22px] items-center truncate border-r border-border px-2 last:border-r-0';

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label="GraphQL operations"
      className="relative min-h-0 flex-1 overflow-auto"
      onScroll={(event) => {
        const el = event.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
      }}
    >
      <div role="row" className={cn('sticky top-0 z-10 grid border-b border-border bg-surface font-medium text-muted-foreground', grid)}>
        <div role="columnheader" className={cell}>Operation</div>
        {!compact && (
          <>
            <div role="columnheader" className={cell}>Status</div>
            <div role="columnheader" className={cn(cell, 'justify-end')}>Size</div>
            <div role="columnheader" className={cn(cell, 'justify-end')}>Time</div>
            <div role="columnheader" className={cell}>URL</div>
          </>
        )}
      </div>

      {rows.map((operation, index) => {
        const selected = operation.id === selectedId;
        const status = getStatus(operation);
        const pending = isPending(operation);
        return (
          <div
            key={operation.id}
            role="row"
            aria-selected={selected}
            onClick={() => onSelect(operation.id)}
            className={cn(
              'grid cursor-default',
              grid,
              selected
                ? 'bg-selected text-selected-foreground'
                : cn(index % 2 ? 'bg-row-alt' : 'bg-background', 'hover:bg-row-hover'),
            )}
          >
            <div role="gridcell" className={cell}>
              <NameCell operation={operation} selected={selected} match={match} compact={compact} />
            </div>
            {!compact && (
              <>
                <div role="gridcell" className={cn(cell, 'gap-1.5')}>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[status.tone])} />
                  <span className={cn(!selected && TONE_TEXT[status.tone])}>
                    {status.label}
                  </span>
                </div>
                <div role="gridcell" className={cn(cell, 'justify-end tabular-nums', !selected && 'text-muted-foreground')}>
                  {pending ? '—' : formatBytes(operation.response?.size ?? 0)}
                </div>
                <div role="gridcell" className={cn(cell, 'justify-end tabular-nums', !selected && 'text-muted-foreground')}>
                  {pending ? <Elapsed since={operation.timestamp} /> : formatDuration(operation.duration ?? 0)}
                </div>
                <div
                  role="gridcell"
                  className={cn(cell, 'block leading-[22px]', !selected && 'text-muted-foreground')}
                  title={operation.request?.url}
                >
                  {operation.request?.url ?? '—'}
                </div>
              </>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="absolute inset-x-0 top-[23px] flex justify-center px-6 pt-[12vh] text-center">{empty}</div>
      )}
    </div>
  );
}
