import { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import {
  GraphQLOperation,
  CacheEntry,
  GraphQLSchema,
  GraphQLError,
  OperationRequestInfo,
  CacheWrite,
  ExecuteResult,
  OperationResponseInfo,
} from './types';

export type GraphQLDevToolEventMap = {
  // Control
  'graphql-enable': unknown;
  'graphql-disable': unknown;

  // Operations
  'operation-start': {
    operation: GraphQLOperation;
  };
  'operation-update': {
    id: string;
    updates: Partial<GraphQLOperation>;
  };
  'operation-complete': {
    id: string;
    data: any;
    duration: number;
    errors?: GraphQLError[];
    request?: OperationRequestInfo;
    response?: OperationResponseInfo;
  };
  'operation-error': {
    id: string;
    /** Partial data sent alongside GraphQL errors */
    data?: any;
    error: GraphQLError;
    duration: number;
    errors?: GraphQLError[];
    request?: OperationRequestInfo;
    response?: OperationResponseInfo;
  };

  // Cache
  'cache-snapshot': {
    entries: CacheEntry[];
  };
  'get-cache-snapshot': unknown;
  'cache-write': {
    write: CacheWrite;
  };

  // Schema/Explorer
  'schema-loaded': {
    schema: GraphQLSchema;
  };
  'get-schema': unknown;

  // Actions from panel to RN
  'clear-operations': unknown;
  'execute-operation': {
    requestId: string;
    query: string;
    variables?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  'execute-result': ExecuteResult;
};

export type GraphQLDevToolsClient = RozeniteDevToolsClient<GraphQLDevToolEventMap>;

