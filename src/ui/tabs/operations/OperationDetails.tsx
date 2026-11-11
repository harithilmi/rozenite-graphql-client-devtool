import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { GraphQLError, GraphQLOperation, HttpHeader } from '../../../shared/types';
import { CodeBlock } from '../../components/CodeBlock';
import { CopyButton, IconButton, TAB_CLASS } from '../../components/controls';
import { JsonView } from '../../components/JsonView';
import { cn } from '../../utils/cn';
import { copyText } from '../../utils/clipboard';
import { toCurl } from '../../utils/curl';
import { formatBytes, formatClock, formatDuration, formatQuery, toJson } from '../../utils/format';
import { getStatus, isPending, TONE_DOT } from './model';

export const DETAIL_TABS = ['headers', 'request', 'response', 'raw'] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];

const TAB_LABEL: Record<DetailTab, string> = {
  headers: 'Headers',
  request: 'Request',
  response: 'Response',
  raw: 'Response (Raw)',
};

function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-border last:border-b-0">
      <div className="flex h-7 items-center gap-2 pr-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex h-full flex-1 items-center gap-1 px-2 text-left font-semibold hover:bg-muted"
        >
          <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-90')} />
          {title}
        </button>
        {actions}
      </div>
      {open && <div className="px-3 pb-3 pl-6">{children}</div>}
    </section>
  );
}

/** Chrome Network style "name: value" rows. Click a row to copy it */
function KeyValueList({ rows }: { rows: Array<HttpHeader & { display?: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)] gap-x-4 leading-[20px]">
      {rows.map(({ name, value, display }) => (
        <div
          key={name}
          className="contents cursor-pointer [&:hover>*]:bg-muted"
          title="Click to copy"
          onClick={() => copyText(`${name}: ${value}`)}
        >
          <dt className="break-words rounded-l-sm pl-1 font-medium text-muted-foreground">{name}</dt>
          <dd className="select-text break-all rounded-r-sm pr-1">{display ?? value}</dd>
        </div>
      ))}
    </dl>
  );
}

const headerText = (headers: HttpHeader[]) =>
  headers.length ? headers.map((h) => `${h.name}: ${h.value}`).join('\n') : null;

const Empty = ({ children }: { children: ReactNode }) => (
  <div className="flex h-full items-center justify-center p-6 text-muted-foreground">{children}</div>
);

function HeadersView({ operation }: { operation: GraphQLOperation }) {
  const status = getStatus(operation);
  const general = [
    { name: 'Request URL', value: operation.request?.url ?? 'Unknown (no HTTP link response)' },
    {
      name: 'Status Code',
      value: status.label,
      display: (
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', TONE_DOT[status.tone])} />
          {status.label}
        </span>
      ),
    },
    { name: 'Started', value: formatClock(operation.timestamp) },
    ...(operation.duration !== undefined ? [{ name: 'Duration', value: formatDuration(operation.duration) }] : []),
    { name: 'Request Size', value: formatBytes(operation.request?.size ?? 0) },
    { name: 'Response Size', value: formatBytes(operation.response?.size ?? 0) },
  ];
  const requestHeaders = operation.request?.headers ?? [];
  const responseHeaders = operation.response?.headers ?? [];
  return (
    <>
      <Section title="General">
        <KeyValueList rows={general} />
      </Section>
      <Section title={`Request Headers (${requestHeaders.length})`} actions={<CopyButton text={headerText(requestHeaders)} />}>
        {requestHeaders.length ? <KeyValueList rows={requestHeaders} /> : <p className="text-muted-foreground">None captured</p>}
      </Section>
      <Section title={`Response Headers (${responseHeaders.length})`} actions={<CopyButton text={headerText(responseHeaders)} />}>
        {responseHeaders.length ? <KeyValueList rows={responseHeaders} /> : <p className="text-muted-foreground">None captured</p>}
      </Section>
    </>
  );
}

function RequestView({ operation, expandAll }: { operation: GraphQLOperation; expandAll: boolean }) {
  const variables = getVariables(operation);
  return (
    <>
      <Section title="Query">
        <CodeBlock code={formatQuery(operation.query)} language="graphql" />
      </Section>
      <Section title={variables ? `Variables (${Object.keys(variables).length})` : 'Variables'}>
        {variables ? (
          <JsonView value={variables} openDepth={expandAll ? Infinity : 3} hideRoot />
        ) : (
          <p className="text-muted-foreground">No variables</p>
        )}
      </Section>
    </>
  );
}

const getVariables = (operation: GraphQLOperation) =>
  operation.variables && Object.keys(operation.variables).length > 0 ? operation.variables : null;

export function ErrorList({ errors }: { errors: GraphQLError[] }) {
  return (
    <div className="m-2 rounded border border-destructive/30 bg-destructive/[0.05]">
      <div className="border-b border-destructive/30 px-3 py-1.5 font-semibold text-destructive">
        {errors.length === 1 ? '1 error' : `${errors.length} errors`}
      </div>
      <ul className="divide-y divide-destructive/20">
        {errors.map((error, index) => {
          const code = error.extensions?.code;
          return (
            <li key={index} className="space-y-0.5 px-3 py-1.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium text-foreground">{error.message}</span>
                {typeof code === 'string' && (
                  <span className="rounded bg-destructive/15 px-1.5 font-mono text-[10.5px] font-semibold text-destructive">{code}</span>
                )}
              </div>
              {(error.path || error.locations) && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  {error.path && <>path: {error.path.join('.')}</>}
                  {error.path && error.locations && ' · '}
                  {error.locations && <>at {error.locations.map((l) => `${l.line}:${l.column}`).join(', ')}</>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 408: 'Request Timeout',
  413: 'Payload Too Large', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout',
};

function NetworkError({ operation }: { operation: GraphQLOperation }) {
  const status = operation.response?.status;
  const rows: HttpHeader[] = [
    ...(status ? [{ name: 'Status', value: `${status} ${STATUS_TEXT[status] ?? ''}`.trim() }] : []),
    { name: 'Error', value: operation.error?.message ?? 'Network error' },
    ...(operation.request?.url ? [{ name: 'URL', value: operation.request.url }] : []),
    ...(operation.duration !== undefined ? [{ name: 'Failed after', value: formatDuration(operation.duration) }] : []),
  ];
  return (
    <div className="m-2 rounded border border-destructive/30 bg-destructive/[0.05]">
      <div className="border-b border-destructive/30 px-3 py-1.5 font-semibold text-destructive">
        {status ? `HTTP ${status} · the server returned no GraphQL response` : 'Request failed · no response from the server'}
      </div>
      <div className="px-2 py-1.5">
        <KeyValueList rows={rows} />
      </div>
    </div>
  );
}

/** What the server sent back, in GraphQL response shape */
const responseBody = (operation: GraphQLOperation) =>
  operation.errors?.length ? { data: operation.data ?? null, errors: operation.errors } : { data: operation.data };

const hasBody = (operation: GraphQLOperation) =>
  !isPending(operation) && !(operation.status === 'error' && !operation.errors?.length);

function ResponseView({ operation, raw, expandAll }: { operation: GraphQLOperation; raw: boolean; expandAll: boolean }) {
  if (isPending(operation)) return <Empty>Waiting for response…</Empty>;
  if (!hasBody(operation)) return <NetworkError operation={operation} />;
  const body = responseBody(operation);
  return (
    <>
      {!raw && operation.errors?.length ? <ErrorList errors={operation.errors} /> : null}
      <div className="p-3">
        {raw ? <CodeBlock code={toJson(body)} language="json" /> : <JsonView name="data" value={body.data} openDepth={expandAll ? Infinity : 4} />}
      </div>
    </>
  );
}

/** Copy actions for the current tab, shown at the right of the tab strip */
function TabActions({ operation, tab }: { operation: GraphQLOperation; tab: DetailTab }) {
  if (tab === 'headers') {
    const headers = [...(operation.request?.headers ?? []), ...(operation.response?.headers ?? [])];
    return <CopyButton text={headerText(headers)}>Copy All Headers</CopyButton>;
  }
  if (tab === 'request') {
    const variables = getVariables(operation);
    return (
      <>
        <CopyButton text={formatQuery(operation.query)}>Copy Query</CopyButton>
        <CopyButton text={variables && toJson(variables)}>Copy Vars</CopyButton>
        <CopyButton text={toCurl(operation)}>Copy as cURL</CopyButton>
      </>
    );
  }
  if (!hasBody(operation)) return <CopyButton text={toCurl(operation)}>Copy as cURL</CopyButton>;
  return <CopyButton text={toJson(responseBody(operation))}>Copy Response</CopyButton>;
}

interface Props {
  operation: GraphQLOperation;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
  /** Text to mark in the pane (from the Search panel) */
  searchTerm?: string;
}

/** Marks every match of `term` inside `root` with the CSS Custom Highlight API and scrolls to the first */
function useSearchHighlight(root: HTMLElement | null, term: string | undefined, deps: unknown[]) {
  useEffect(() => {
    if (!root || !term || typeof CSS === 'undefined' || !CSS.highlights) return;
    const needle = term.toLowerCase();
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.toLowerCase() ?? '';
      for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) {
        const range = new Range();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        ranges.push(range);
      }
    }
    CSS.highlights.set('search-hit', new Highlight(...ranges));
    ranges[0]?.startContainer.parentElement?.scrollIntoView({ block: 'center' });
    return () => {
      CSS.highlights.delete('search-hit');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, term, ...deps]);
}

export function OperationDetails({ operation, tab, onTabChange, onClose, searchTerm }: Props) {
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  useSearchHighlight(content, searchTerm, [operation.id, tab]);
  const expandAll = Boolean(searchTerm);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div role="tablist" className="flex h-[30px] shrink-0 items-stretch border-b border-border bg-surface">
        <IconButton aria-label="Close details" title="Close" onClick={onClose} className="mx-1 self-center">
          <X className="h-3.5 w-3.5" />
        </IconButton>
        {DETAIL_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTabChange(id)}
            className={TAB_CLASS}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 pl-2 pr-1.5">
          <TabActions operation={operation} tab={tab} />
        </div>
      </div>
      <div ref={setContent} className="min-h-0 flex-1 overflow-auto" key={operation.id}>
        {tab === 'headers' && <HeadersView operation={operation} />}
        {tab === 'request' && <RequestView operation={operation} expandAll={expandAll} />}
        {tab === 'response' && <ResponseView operation={operation} raw={false} expandAll={expandAll} />}
        {tab === 'raw' && <ResponseView operation={operation} raw expandAll={expandAll} />}
      </div>
    </div>
  );
}
