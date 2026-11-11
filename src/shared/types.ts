// Core operation types
export type OperationType = 'query' | 'mutation' | 'subscription';
export type OperationStatus = 'pending' | 'loading' | 'success' | 'error' | 'active';

// GraphQL Error type
export interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: (string | number)[];
  extensions?: Record<string, any>;
}

export interface HttpHeader {
  name: string;
  value: string;
}

/** HTTP details of the request that carried the operation (when the link can see them) */
export interface OperationRequestInfo {
  url?: string;
  headers?: HttpHeader[];
  /** Body size in bytes (JSON payload) */
  size: number;
}

export interface OperationResponseInfo {
  /** HTTP status code. Undefined when the transport has no HTTP response (e.g. websocket) */
  status?: number;
  headers?: HttpHeader[];
  /** Body size in bytes (JSON payload) */
  size: number;
}

// Operation tracking
export interface GraphQLOperation {
  id: string;
  operationName: string;
  operationType: OperationType;
  query: string;
  variables?: Record<string, any>;
  timestamp: number;
  status: OperationStatus;
  duration?: number;
  data?: any;
  /** First error, or the network error. Kept for older panels */
  error?: GraphQLError;
  /** Every GraphQL error returned in the response */
  errors?: GraphQLError[];
  request?: OperationRequestInfo;
  response?: OperationResponseInfo;
  /**
   * Optional context data (excluded by default to avoid circular references)
   */
  context?: Record<string, any>;
  /**
   * Optional metadata for subscriptions
   */
  metadata?: {
    parentId?: string;      // ID of the parent subscription (for events)
    eventNumber?: number;   // Event number for subscription events
    eventCount?: number;    // Total events received (for parent subscription)
    isActive?: boolean;     // Whether subscription is still active
    completed?: boolean;    // Whether subscription has completed
  };
}

// Cache entries
export interface CacheEntry {
  id: string;
  key: string;
  typename?: string;
  data: any;
  timestamp: number;
}

/** One write into the client cache (query result, mutation, writeQuery/writeFragment...) */
export interface CacheWrite {
  id: string;
  timestamp: number;
  /** Cache ID written to, e.g. ROOT_QUERY or Book:1 */
  dataId: string;
  /** Operation or fragment name of the document that was written */
  documentName?: string;
  variables?: Record<string, unknown>;
  result: unknown;
}

/** Result of an operation run from the Explorer tab */
export interface ExecuteResult {
  requestId: string;
  data?: unknown;
  errors?: GraphQLError[];
  /** Network/client error message */
  error?: string;
  duration: number;
}

// Schema introspection types
export interface GraphQLArgument {
  name: string;
  type: string;
  defaultValue?: string;
  description?: string;
}

export interface GraphQLField {
  name: string;
  type: string;
  args?: GraphQLArgument[];
  description?: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export type GraphQLTypeKind =
  | 'OBJECT'
  | 'INTERFACE'
  | 'UNION'
  | 'ENUM'
  | 'INPUT_OBJECT'
  | 'SCALAR';

export interface GraphQLType {
  name: string;
  kind: GraphQLTypeKind;
  fields?: GraphQLField[];
  description?: string;
  interfaces?: string[];
  possibleTypes?: string[];
  enumValues?: string[];
}

export interface GraphQLSchema {
  queryType?: GraphQLType;
  mutationType?: GraphQLType;
  subscriptionType?: GraphQLType;
  types: GraphQLType[];
}

