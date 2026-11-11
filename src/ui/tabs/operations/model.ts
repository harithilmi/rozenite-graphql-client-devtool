import type { GraphQLOperation, OperationType } from '../../../shared/types';

export const OPERATION_TYPES = ['query', 'mutation', 'subscription'] as const satisfies readonly OperationType[];

export const TYPE_META = {
  query: { letter: 'Q', label: 'Queries', text: 'text-op-query', dot: 'bg-op-query', badge: 'bg-op-query/15 text-op-query', chip: 'bg-op-query/15 text-op-query ring-op-query/40' },
  mutation: { letter: 'M', label: 'Mutations', text: 'text-op-mutation', dot: 'bg-op-mutation', badge: 'bg-op-mutation/15 text-op-mutation', chip: 'bg-op-mutation/15 text-op-mutation ring-op-mutation/40' },
  subscription: { letter: 'S', label: 'Subscriptions', text: 'text-op-subscription', dot: 'bg-op-subscription', badge: 'bg-op-subscription/15 text-op-subscription', chip: 'bg-op-subscription/15 text-op-subscription ring-op-subscription/40' },
} satisfies Record<OperationType, Record<'letter' | 'label' | 'text' | 'dot' | 'badge' | 'chip', string>>;

export interface OperationFilter {
  text: string;
  isRegex: boolean;
  isInverted: boolean;
  types: Record<OperationType, boolean>;
}

export const initialFilter: OperationFilter = {
  text: '',
  isRegex: false,
  isInverted: false,
  types: { query: true, mutation: true, subscription: true },
};

/** Where the filter text matches a name, or null. Throws on a bad regex */
export type NameMatcher = (name: string) => [start: number, end: number] | null;

const buildMatcher = ({ text, isRegex }: OperationFilter): NameMatcher => {
  if (!isRegex) {
    const needle = text.toLowerCase();
    return (name) => {
      const at = name.toLowerCase().indexOf(needle);
      return at < 0 ? null : [at, at + needle.length];
    };
  }
  // Accept both "abc" and "/abc/i"
  const literal = /^\/(.*)\/([a-z]*)$/.exec(text);
  const regex = literal ? new RegExp(literal[1], literal[2].replace('g', '')) : new RegExp(text, 'i');
  return (name) => {
    const match = regex.exec(name);
    return match ? [match.index, match.index + match[0].length] : null;
  };
};

/**
 * Filters by operation type, then by name (plain text or /regex/).
 * Returns the matcher too, so the table can highlight the matched part.
 */
export const filterOperations = (
  operations: GraphQLOperation[],
  filter: OperationFilter,
): { rows: GraphQLOperation[]; match?: NameMatcher; error?: string } => {
  let match: NameMatcher | undefined;
  if (filter.text) {
    try {
      match = buildMatcher(filter);
    } catch (error) {
      return { rows: [], error: error instanceof Error ? error.message : 'Invalid regex' };
    }
  }
  const rows = operations.filter((operation) => {
    if (!filter.types[operation.operationType]) return false;
    if (!match) return true;
    return (match(operation.operationName) !== null) !== filter.isInverted;
  });
  // Inverted rows don't contain the match, so nothing to highlight
  return { rows, match: filter.isInverted ? undefined : match };
};

export type StatusTone = 'success' | 'error' | 'warning' | 'pending';

export const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  error: 'bg-destructive',
  warning: 'bg-warning',
  pending: 'animate-spin border-[1.5px] border-muted-foreground border-t-transparent',
};

/** What the Status column shows: HTTP code when known, else the lifecycle state */
export const getStatus = (operation: GraphQLOperation): { label: string; tone: StatusTone } => {
  if (operation.status === 'active') return { label: 'listening', tone: 'pending' };
  if (operation.status === 'loading' || operation.status === 'pending') {
    return { label: '(pending)', tone: 'pending' };
  }
  const http = operation.response?.status;
  if (http !== undefined) {
    if (http >= 400) return { label: String(http), tone: 'error' };
    // HTTP fine but the GraphQL response carries errors: say so, not only by colour
    const errors = operation.errors?.length ?? 0;
    if (errors) return { label: `${http} · ${errors} err`, tone: 'warning' };
    return { label: String(http), tone: http >= 300 ? 'warning' : 'success' };
  }
  // No HTTP response at all: the request never reached the server
  if (operation.status === 'error' && !operation.errors?.length) {
    return { label: '(failed)', tone: 'error' };
  }
  return { label: 'OK', tone: 'success' };
};

export const isPending = (operation: GraphQLOperation) =>
  operation.status === 'loading' || operation.status === 'pending';

export const errorCount = (operation: GraphQLOperation) =>
  operation.errors?.length ?? (operation.status === 'error' ? 1 : 0);

/** The request itself failed (no GraphQL body): network error or HTTP 4xx/5xx */
export const isFailed = (operation: GraphQLOperation) =>
  operation.status === 'error' && !operation.errors?.length;
