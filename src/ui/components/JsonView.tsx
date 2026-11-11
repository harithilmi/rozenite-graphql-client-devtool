// Collapsible JSON tree built on native <details>, styled like DevTools' object preview
type Json = string | number | boolean | null | undefined | Json[] | { [key: string]: Json };

const isBranch = (value: Json): value is Json[] | { [key: string]: Json } =>
  typeof value === 'object' && value !== null;

/** Apollo normalized-cache reference: { __ref: "Book:1" } */
const refOf = (value: Json): string | null =>
  isBranch(value) && !Array.isArray(value) && typeof value.__ref === 'string' && Object.keys(value).length === 1
    ? value.__ref
    : null;

type OnRef = (id: string) => void;

function Primitive({ value }: { value: Json }) {
  if (typeof value === 'string') return <span className="text-[hsl(var(--code-string))]">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-[hsl(var(--code-number))]">{value}</span>;
  if (value === undefined) return <span className="text-muted-foreground">undefined</span>;
  return <span className="text-[hsl(var(--code-literal))]">{String(value)}</span>;
}

function Key({ name }: { name?: string }) {
  if (name === undefined) return null;
  return (
    <>
      <span className="text-[hsl(var(--code-key))]">{name}</span>
      <span className="text-muted-foreground">: </span>
    </>
  );
}

function Node({ name, value, depth, openDepth, onRef }: { name?: string; value: Json; depth: number; openDepth: number; onRef?: OnRef }) {
  const ref = onRef ? refOf(value) : null;
  if (ref && onRef) {
    return (
      <div className="pl-[14px]">
        <Key name={name} />
        <button
          type="button"
          onClick={() => onRef(ref)}
          title={`Go to ${ref}`}
          className="rounded-sm text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {ref}
        </button>
      </div>
    );
  }
  if (!isBranch(value)) {
    return (
      <div className="pl-[14px]">
        <Key name={name} />
        <Primitive value={value} />
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  const typename = !Array.isArray(value) && typeof value.__typename === 'string' ? value.__typename : null;

  if (entries.length === 0) {
    return (
      <div className="pl-[14px]">
        <Key name={name} />
        <span className="text-muted-foreground">{open + close}</span>
      </div>
    );
  }

  return (
    <details open={depth < openDepth} className="group">
      <summary className="cursor-pointer list-none rounded-sm hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span className="inline-block w-[14px] text-center text-[9px] text-muted-foreground transition-transform group-open:rotate-90">
          ▶
        </span>
        <Key name={name} />
        {typename && <span className="mr-1 italic text-muted-foreground">{typename}</span>}
        <span className="text-muted-foreground">
          {Array.isArray(value) ? `Array(${entries.length})` : `{…} ${entries.length} ${entries.length === 1 ? 'key' : 'keys'}`}
        </span>
      </summary>
      <div className="ml-[6px] border-l border-border pl-[8px]">
        {entries.map(([key, child]) => (
          <Node key={key} name={key} value={child} depth={depth + 1} openDepth={openDepth} onRef={onRef} />
        ))}
      </div>
    </details>
  );
}

interface JsonViewProps {
  value: unknown;
  /** Label for the root, e.g. "data" */
  name?: string;
  openDepth?: number;
  /** Show the root's children directly, without the root summary line */
  hideRoot?: boolean;
  /** Makes `{ __ref }` values clickable links */
  onRef?: OnRef;
}

export function JsonView({ value, name, openDepth = 2, hideRoot, onRef }: JsonViewProps) {
  // Values come from JSON payloads, so they fit the Json type
  return (
    <div className="font-mono text-[11.5px] leading-[18px]">
      {hideRoot && isBranch(value as Json) ? (
        Object.entries(value as Record<string, Json>).map(([key, child]) => (
          <Node key={key} name={key} value={child} depth={1} openDepth={openDepth} onRef={onRef} />
        ))
      ) : (
        <Node name={name} value={value as Json} depth={0} openDepth={openDepth} onRef={onRef} />
      )}
    </div>
  );
}
