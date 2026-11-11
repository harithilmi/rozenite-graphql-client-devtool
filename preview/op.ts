// Helpers to build fixture operations with realistic HTTP metadata.
import type {
  CacheEntry,
  GraphQLError,
  GraphQLOperation,
  GraphQLSchema,
  HttpHeader,
  OperationType,
} from '../src/shared/types';

export interface Fixture {
  operation: GraphQLOperation;
  /** Never completes: shows the pending state */
  pending?: boolean;
}

export interface FixtureSet {
  operations: Fixture[];
  cache: CacheEntry[];
  schema: GraphQLSchema;
}

const URL = 'https://api.example.com/graphql';

const requestHeaders: HttpHeader[] = [
  { name: 'content-type', value: 'application/json' },
  { name: 'accept', value: 'application/graphql-response+json, application/json' },
  {
    name: 'authorization',
    value:
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzQyIiwiZXhwIjoxOTAwMDAwMDAwfQ.c2lnbmF0dXJl',
  },
  { name: 'x-app-version', value: '3.2.0 (412)' },
];

const responseHeaders = (status: number): HttpHeader[] => [
  { name: 'content-type', value: 'application/json; charset=utf-8' },
  { name: 'cache-control', value: 'no-store' },
  { name: 'x-request-id', value: `req_${status}_8f2c1a` },
];

const bytes = (value: unknown) => new Blob([JSON.stringify(value) ?? '']).size;

let counter = 0;

/** Build a finished operation with realistic request/response metadata */
export const op = (input: {
  name: string;
  type?: OperationType;
  query: string;
  variables?: Record<string, unknown>;
  data?: unknown;
  errors?: GraphQLError[];
  networkError?: string;
  status?: number;
  duration: number;
  url?: string;
}): GraphQLOperation => {
  const {
    name,
    type = 'query',
    query,
    variables,
    data,
    errors,
    networkError,
    status = 200,
    duration,
    url = URL,
  } = input;
  const body = errors ? { data: data ?? null, errors } : { data };
  const failed = Boolean(networkError || errors);
  const error = networkError
    ? { message: networkError }
    : errors?.[0] && { ...errors[0], message: errors.map((e) => e.message).join(', ') };

  return {
    id: `${name}-${counter++}`,
    operationName: name,
    operationType: type,
    query,
    variables,
    timestamp: 0,
    status: failed ? 'error' : 'success',
    duration,
    data: networkError ? undefined : data,
    error,
    errors,
    request: {
      url,
      headers: requestHeaders,
      size: bytes({ operationName: name, variables, query }),
    },
    response: {
      status,
      headers: responseHeaders(status),
      size: networkError ? 0 : bytes(body),
    },
  };
};
