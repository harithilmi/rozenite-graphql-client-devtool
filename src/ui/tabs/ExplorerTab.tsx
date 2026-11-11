import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { getOperationAST } from 'graphql';
import type { GraphQLField } from '../../shared/types';
import { CodeEditor } from '../components/CodeEditor';
import { CopyButton, TAB_CLASS } from '../components/controls';
import { JsonView } from '../components/JsonView';
import { useActions, useExecution, useExplorerDraft, useSchema } from '../store/hooks';
import { cn } from '../utils/cn';
import { formatDuration, toJson } from '../utils/format';
import { DocsPanel } from './explorer/DocsPanel';
import { parseOperation, toggleField, type RootKind } from './explorer/operationAst';
import { ErrorList } from './operations/OperationDetails';

type JsonResult = { value: Record<string, unknown>; error?: undefined } | { value?: undefined; error: string };

/** Parse a JSON object from an editor; empty means {} */
const parseObject = (text: string): JsonResult => {
  if (!text.trim()) return { value: {} };
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { error: 'Must be a JSON object' };
    return { value: value as Record<string, unknown> };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
};

function Centered({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
      <div className="font-semibold">{title}</div>
      {hint && <div className="max-w-sm text-muted-foreground">{hint}</div>}
      {children}
    </div>
  );
}

function ResponsePane() {
  const execution = useExecution();
  const result = execution?.result;
  return (
    <section className="flex w-[38%] min-w-[280px] shrink-0 flex-col border-l border-border">
      <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
        <span className="font-semibold">Response</span>
        {result && (
          <>
            <span className={cn('h-2 w-2 rounded-full', result.error ? 'bg-destructive' : result.errors?.length ? 'bg-warning' : 'bg-success')} />
            <span className="text-muted-foreground">{formatDuration(result.duration)}</span>
            <span className="ml-auto">
              <CopyButton text={toJson(result.error ? { error: result.error } : { data: result.data, errors: result.errors })} />
            </span>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {!execution && <Centered title="No response yet" hint="Build an operation from the Documentation panel or type one, then press Run (⌘/Ctrl+Enter)." />}
        {execution && !result && <Centered title="Running…" />}
        {result?.error && (
          <div className="m-2 rounded border border-destructive/30 bg-destructive/[0.05] px-3 py-2">
            <div className="font-semibold text-destructive">Request failed</div>
            <div className="mt-0.5 font-mono text-[11.5px]">{result.error}</div>
          </div>
        )}
        {result?.errors?.length ? <ErrorList errors={result.errors} /> : null}
        {result && !result.error && (
          <div className="p-3">
            <JsonView name="data" value={result.data ?? null} openDepth={4} />
          </div>
        )}
      </div>
    </section>
  );
}

export function ExplorerTab() {
  const schema = useSchema();
  const draft = useExplorerDraft();
  const execution = useExecution();
  const { requestSchema, setExplorerDraft, execute } = useActions();
  const [bottomTab, setBottomTab] = useState<'variables' | 'headers'>('variables');

  // Introspection runs only when someone opens this tab
  useEffect(() => {
    if (!schema) requestSchema();
  }, [schema, requestSchema]);

  const document = useMemo(() => parseOperation(draft.query), [draft.query]);
  const operation = document ? getOperationAST(document) : null;
  const variables = parseObject(draft.variables);
  const headers = parseObject(draft.headers);
  const running = Boolean(execution && !execution.result);
  const canRun = Boolean(operation) && !variables.error && !headers.error && !running;

  const run = () => {
    if (!canRun) return;
    execute({
      query: draft.query,
      variables: variables.value,
      headers: Object.fromEntries(Object.entries(headers.value ?? {}).map(([k, v]) => [k, String(v)])),
    });
  };

  const onToggle = (kind: RootKind, fields: GraphQLField[]) => {
    const { text, addedVariables } = toggleField(draft.query, kind, fields);
    // New required arguments get a null placeholder in Variables, ready to fill in
    const current = parseObject(draft.variables).value;
    const nextVariables =
      current && addedVariables.length
        ? toJson({ ...current, ...Object.fromEntries(addedVariables.map((v) => [v.name, current[v.name] ?? null])) })
        : draft.variables;
    setExplorerDraft({ query: text, variables: nextVariables });
  };

  if (!schema) return <Centered title="Loading schema…" hint="Sending an introspection query through your app's Apollo Client." />;
  if (!schema.types.length) {
    return (
      <Centered title="Schema not available" hint="The introspection query failed. Introspection may be disabled on this server.">
        <button type="button" onClick={requestSchema} className="mt-1 font-medium text-primary hover:underline">
          Try again
        </button>
      </Centered>
    );
  }

  const queryError = draft.query.trim() && !document ? 'Syntax error' : null;
  const jsonError = bottomTab === 'variables' ? variables.error : headers.error;

  return (
    <div className="flex h-full">
      <DocsPanel schema={schema} document={document} onToggle={onToggle} />

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-border bg-surface pl-2 pr-1.5">
          <span className="font-semibold">Operation</span>
          {queryError && <span className="text-destructive">{queryError}</span>}
          <span className="ml-auto flex items-center gap-1.5">
            <CopyButton text={draft.query.trim() ? draft.query : null} />
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              title="Run (⌘/Ctrl+Enter)"
              className="inline-flex h-[22px] max-w-[220px] items-center gap-1 rounded bg-primary px-2 font-medium text-primary-foreground hover:brightness-110 disabled:opacity-40"
            >
              <Play className="h-3 w-3 shrink-0" fill="currentColor" />
              <span className="truncate">{running ? 'Running…' : operation?.name?.value ?? 'Run'}</span>
            </button>
          </span>
        </div>
        <CodeEditor
          label="Operation"
          language="graphql"
          value={draft.query}
          onChange={(query) => setExplorerDraft({ query })}
          onRun={run}
          placeholder={'# Pick fields in Documentation, or type an operation:\nquery {\n  \n}'}
          className="flex-[3]"
        />

        <div role="tablist" className="flex h-[28px] shrink-0 items-stretch border-y border-border bg-surface">
          {(['variables', 'headers'] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={bottomTab === id} onClick={() => setBottomTab(id)} className={TAB_CLASS}>
              {id === 'variables' ? 'Variables' : 'Headers'}
            </button>
          ))}
          {jsonError && <span className="ml-auto self-center pr-2 text-destructive">{jsonError}</span>}
        </div>
        <CodeEditor
          key={bottomTab}
          label={bottomTab === 'variables' ? 'Variables' : 'Headers'}
          language="json"
          value={bottomTab === 'variables' ? draft.variables : draft.headers}
          onChange={(text) => setExplorerDraft(bottomTab === 'variables' ? { variables: text } : { headers: text })}
          onRun={run}
          placeholder={bottomTab === 'headers' ? '{ "x-debug": "1" }  (sent on top of your app\'s own headers)' : '{}'}
          className="flex-[2]"
        />
      </section>

      <ResponsePane />
    </div>
  );
}
