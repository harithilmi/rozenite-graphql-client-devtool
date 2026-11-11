/** 1234 -> "1.23 kB" (decimal units, like Chrome's Network panel) */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 2 : 1)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
};

/** 182 -> "182 ms", 1204 -> "1.20 s" */
export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;

export const formatClock = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export const toJson = (value: unknown): string => JSON.stringify(value, null, 2) ?? '';

/**
 * graphql's print() keeps variable definitions on one line. Put each on its own line
 * when the operation header gets long, so the query fits a narrow pane.
 */
export const formatQuery = (query: string): string =>
  query.replace(
    /^((?:query|mutation|subscription)\s*\w*)\((.+)\)( \{)$/gm,
    (line, head: string, defs: string, tail: string) =>
      line.length <= 80 ? line : `${head}(\n  ${defs.split(/, (?=\$)/).join('\n  ')}\n)${tail}`,
  );
