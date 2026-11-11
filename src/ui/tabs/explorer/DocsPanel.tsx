import { useMemo, useState } from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import type { GraphQLField, GraphQLSchema, GraphQLType } from '../../../shared/types';
import { cn } from '../../utils/cn';
import { isSelected, namedType, type RootKind } from './operationAst';
import type { DocumentNode } from 'graphql';

const ROOT_LABEL: Record<RootKind, string> = { query: 'Query', mutation: 'Mutation', subscription: 'Subscription' };

const rootType = (schema: GraphQLSchema, kind: RootKind): GraphQLType | undefined =>
  ({ query: schema.queryType, mutation: schema.mutationType, subscription: schema.subscriptionType })[kind];

interface Props {
  schema: GraphQLSchema;
  document: DocumentNode | null;
  onToggle: (kind: RootKind, fields: GraphQLField[]) => void;
}

function FieldRow({
  field,
  selected,
  navigable,
  onToggle,
  onOpen,
}: {
  field: GraphQLField;
  selected: boolean;
  navigable: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <li className="group flex items-center gap-1 pr-1 hover:bg-muted">
      <button
        type="button"
        aria-label={`${selected ? 'Remove' : 'Add'} ${field.name}`}
        aria-pressed={selected}
        onClick={onToggle}
        className={cn(
          'ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground opacity-60 group-hover:opacity-100',
        )}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : <Plus className="h-3 w-3" />}
      </button>
      <button
        type="button"
        onClick={navigable ? onOpen : onToggle}
        title={field.description}
        className="flex min-w-0 flex-1 items-baseline gap-1.5 py-[3px] text-left"
      >
        <span className={cn('truncate font-mono text-[11.5px]', field.isDeprecated && 'line-through')}>
          {field.name}
          {field.args?.length ? <span className="text-muted-foreground">(…)</span> : null}
        </span>
        <span className="truncate font-mono text-[11px] text-[hsl(var(--code-number))]">{field.type}</span>
      </button>
      {navigable && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </li>
  );
}

/** Schema documentation you can click through; ⊕ adds the field to the operation (like Apollo Sandbox) */
export function DocsPanel({ schema, document, onToggle }: Props) {
  const [kind, setKind] = useState<RootKind | null>(null);
  const [path, setPath] = useState<GraphQLField[]>([]);
  const [search, setSearch] = useState('');

  const typeByName = useMemo(() => new Map(schema.types.map((type) => [type.name, type])), [schema]);
  const hasFields = (field: GraphQLField) => Boolean(typeByName.get(namedType(field.type))?.fields?.length);

  const last = path[path.length - 1] as GraphQLField | undefined;
  const type = kind ? (last ? typeByName.get(namedType(last.type)) : rootType(schema, kind)) : undefined;
  const needle = search.toLowerCase();
  const fields = (type?.fields ?? []).filter((field) => field.name.toLowerCase().includes(needle));
  const names = path.map((field) => field.name);

  const open = (next: RootKind | null, nextPath: GraphQLField[]) => {
    setKind(next);
    setPath(nextPath);
    setSearch('');
  };

  // Root-level search: every root field of every operation type
  const rootHits = (['query', 'mutation', 'subscription'] as const).flatMap((k) =>
    (rootType(schema, k)?.fields ?? [])
      .filter((field) => needle && field.name.toLowerCase().includes(needle))
      .map((field) => ({ kind: k, field })),
  );

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-border">
      <div className="flex h-[30px] shrink-0 items-center border-b border-border bg-surface px-2 font-semibold">Documentation</div>

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-0.5 px-2 pt-2 text-muted-foreground">
        <button type="button" onClick={() => open(null, [])} className="hover:text-foreground hover:underline">
          Schema
        </button>
        {kind && (
          <>
            <ChevronRight className="h-3 w-3" />
            <button type="button" onClick={() => open(kind, [])} className="hover:text-foreground hover:underline">
              {ROOT_LABEL[kind]}
            </button>
          </>
        )}
        {path.map((field, index) => (
          <span key={index} className="inline-flex items-center gap-0.5">
            <ChevronRight className="h-3 w-3" />
            <button type="button" onClick={() => open(kind, path.slice(0, index + 1))} className="font-mono hover:text-foreground hover:underline">
              {field.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="p-2">
        <input
          type="search"
          aria-label="Search the schema"
          placeholder={kind ? `Search ${type?.name ?? ''} fields` : 'Search queries, mutations…'}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="h-[22px] w-full rounded border border-input bg-background px-2 outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {!kind && !needle && (
          <ul>
            {(['query', 'mutation', 'subscription'] as const).map((k) => {
              const count = rootType(schema, k)?.fields?.length ?? 0;
              if (!count) return null;
              return (
                <li key={k}>
                  <button type="button" onClick={() => open(k, [])} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted">
                    <span className="font-semibold">{ROOT_LABEL[k]}</span>
                    <span className="text-muted-foreground">{count} fields</span>
                    <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!kind && needle && (
          <ul>
            {rootHits.map(({ kind: k, field }) => (
              <FieldRow
                key={`${k}.${field.name}`}
                field={field}
                selected={isSelected(document, k, [field.name])}
                navigable
                onToggle={() => onToggle(k, [field])}
                onOpen={() => open(k, [field])}
              />
            ))}
            {rootHits.length === 0 && <li className="px-3 text-muted-foreground">No matches</li>}
          </ul>
        )}

        {kind && (
          <>
            {last && (
              <div className="space-y-1.5 border-b border-border px-3 pb-2">
                <div className="font-mono text-[11.5px]">
                  <span className="font-semibold">{last.name}</span>: <span className="text-[hsl(var(--code-number))]">{last.type}</span>
                </div>
                {last.description && <p className="text-muted-foreground">{last.description}</p>}
                {last.deprecationReason && <p className="text-warning">Deprecated: {last.deprecationReason}</p>}
                {last.args && last.args.length > 0 && (
                  <div>
                    <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Arguments</div>
                    <ul className="font-mono text-[11.5px]">
                      {last.args.map((arg) => (
                        <li key={arg.name} title={arg.description}>
                          {arg.name}: <span className="text-[hsl(var(--code-number))]">{arg.type}</span>
                          {arg.defaultValue !== undefined && <span className="text-muted-foreground"> = {arg.defaultValue}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {type?.description && !last && <p className="px-3 pb-2 text-muted-foreground">{type.description}</p>}

            {fields.length > 0 && (
              <>
                <div className="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fields</div>
                <ul>
                  {fields.map((field) => (
                    <FieldRow
                      key={field.name}
                      field={field}
                      selected={isSelected(document, kind, [...names, field.name])}
                      navigable={hasFields(field)}
                      onToggle={() => onToggle(kind, [...path, field])}
                      onOpen={() => open(kind, [...path, field])}
                    />
                  ))}
                </ul>
              </>
            )}

            {type?.enumValues && (
              <ul className="px-3 font-mono text-[11.5px]">
                {type.enumValues.map((value) => <li key={value}>{value}</li>)}
              </ul>
            )}
            {type?.possibleTypes && (
              <p className="px-3 text-muted-foreground">
                One of: <span className="font-mono">{type.possibleTypes.join(' | ')}</span> (add these with an inline fragment in the editor)
              </p>
            )}
            {type?.kind === 'SCALAR' && <p className="px-3 text-muted-foreground">Scalar · {type.name}</p>}
          </>
        )}
      </div>
    </aside>
  );
}
