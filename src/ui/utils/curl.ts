import type { GraphQLOperation } from '../../shared/types';

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/** Build a cURL command that replays the operation. Needs the request URL */
export const toCurl = (operation: GraphQLOperation): string | null => {
  const url = operation.request?.url;
  if (!url) return null;
  const headers = operation.request?.headers ?? [
    { name: 'content-type', value: 'application/json' },
  ];
  const body = JSON.stringify({
    operationName: operation.operationName,
    query: operation.query,
    variables: operation.variables ?? {},
  });
  return [
    `curl ${quote(url)}`,
    ...headers.map(({ name, value }) => `  -H ${quote(`${name}: ${value}`)}`),
    `  --data-raw ${quote(body)}`,
  ].join(' \\\n');
};
