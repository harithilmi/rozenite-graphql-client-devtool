import {
    GraphQLOperation,
    CacheEntry,
    CacheWrite,
    ExecuteResult,
    GraphQLError,
    GraphQLSchema,
    HttpHeader,
    OperationRequestInfo,
    OperationResponseInfo,
    OperationType,
} from '../../shared/types';
import { GraphQLClientAdapter, AdapterConfig } from './types';
import {
    gql,
    ApolloClient as ApolloClientType,
    ApolloLink,
    Observable,
    FetchResult,
    NextLink,
    Operation,
} from '@apollo/client';
import type { DocumentNode, GraphQLFormattedError, OperationDefinitionNode } from 'graphql';
import { getIntrospectionQuery, buildClientSchema, getOperationAST, parse, print } from 'graphql';
import { toDevtoolSchema } from '../../shared/schema';

// Type alias for Apollo Client
type ApolloClient = ApolloClientType<any>;

/** Context flag for queries the devtool sends itself (introspection). The link skips them */
const INTERNAL_CONTEXT_KEY = '__rozeniteInternal';

const toHeaders = (source: unknown): HttpHeader[] | undefined => {
    if (!source || typeof source !== 'object') return undefined;
    // Fetch `Headers` (has forEach) or a plain object from `setContext({ headers })`
    if ('forEach' in source && typeof source.forEach === 'function') {
        const headers: HttpHeader[] = [];
        (source as Headers).forEach((value, name) => headers.push({ name, value }));
        return headers;
    }
    return Object.entries(source).map(([name, value]) => ({ name, value: String(value) }));
};

const byteSize = (value: unknown): number => {
    const json = JSON.stringify(value) ?? '';
    return typeof TextEncoder === 'undefined' ? json.length : new TextEncoder().encode(json).length;
};

const toPlainError = ({ message, locations, path, extensions }: GraphQLFormattedError): GraphQLError => ({
    message,
    locations: locations && [...locations],
    path: path && [...path],
    extensions,
});

/** Name of the first named definition (operation or fragment) */
const documentName = (document: DocumentNode): string | undefined => {
    for (const definition of document.definitions) {
        if ('name' in definition && definition.name) return definition.name.value;
    }
    return undefined;
};

/**
 * Read HTTP details. HttpLink stores the fetch Response on the context,
 * so this works without knowing the endpoint up front.
 */
const readHttp = (
    operation: Operation,
    body: { operationName: string; query: string; variables?: Record<string, unknown> },
    result?: FetchResult,
    failedResponse?: Response,
): { request: OperationRequestInfo; response: OperationResponseInfo } => {
    const context = operation.getContext();
    const response: Response | undefined = context.response ?? failedResponse;
    const uri = typeof context.uri === 'string' ? context.uri : undefined;
    return {
        request: {
            url: response?.url || uri,
            headers: toHeaders(context.headers),
            size: byteSize(body),
        },
        response: {
            status: response?.status,
            headers: toHeaders(response?.headers),
            size: result ? byteSize(result) : 0,
        },
    };
};

/**
 * Apollo Client adapter for the GraphQL DevTools plugin.
 * 
 * This adapter integrates with Apollo Client using Apollo Link middleware
 * to intercept all GraphQL operations with full request/response lifecycle tracking.
 * 
 * IMPORTANT: Add the Rozenite link as the FIRST link in your Apollo Client chain:
 * ```typescript
 * import { ApolloClient, InMemoryCache, ApolloLink, HttpLink } from '@apollo/client';
 * import { apolloGraphqlDevtoolLink } from 'rozenite-graphql-client-devtool';
 * 
 * const client = new ApolloClient({
 *   link: ApolloLink.from([
 *     apolloGraphqlDevtoolLink(),  // Must be first to capture all operations
 *     new HttpLink({ uri: 'https://api.example.com/graphql' }),
 *   ]),
 *   cache: new InMemoryCache(),
 * });
 * 
 * // Then initialize the adapter
 * const adapter = new ApolloClientAdapter(client);
 * adapter.initialize();
 * ```
 */
export class ApolloClientAdapter implements GraphQLClientAdapter {
    private client: ApolloClient;
    private config: Required<AdapterConfig>;
    private operationCallbacks: Set<(operation: GraphQLOperation) => void> = new Set();
    private cacheCallbacks: Set<(write: CacheWrite) => void> = new Set();
    private restoreCacheWrite?: () => void;
    private writeCounter = 0;
    private operationCounter = 0;

    // ============================================================================
    // Constructor & Configuration
    // ============================================================================

    constructor(client: ApolloClient, config: AdapterConfig = {}) {
        this.client = client;
        this.config = {
            includeVariables: config.includeVariables ?? true,
            includeResponseData: config.includeResponseData ?? true,
            maxOperations: config.maxOperations ?? 1000,
        };
    }

    // ============================================================================
    // Lifecycle Methods
    // ============================================================================

    initialize(): void {
        // Register this adapter globally so the link can find it
        (globalThis as any).__ROZENITE_APOLLO_ADAPTER__ = this;
        this.watchCacheWrites();
    }

    cleanup(): void {
        this.operationCallbacks.clear();
        this.cacheCallbacks.clear();
        this.restoreCacheWrite?.();

        // Unregister global adapter
        if ((globalThis as any).__ROZENITE_APOLLO_ADAPTER__ === this) {
            delete (globalThis as any).__ROZENITE_APOLLO_ADAPTER__;
        }
    }

    /**
     * Every cache write (query results, mutations, writeQuery/writeFragment) goes through
     * cache.write, so wrapping it gives a full write log. Restored on cleanup.
     */
    private watchCacheWrites(): void {
        const cache = this.client.cache;
        const callbacks = this.cacheCallbacks;
        const nextId = () => this.writeCounter++;
        const unwrapped = cache.write;
        const original = cache.write.bind(cache);
        const wrapped: typeof cache.write = (options) => {
            const ref = original(options);
            if (callbacks.size > 0) {
                const write: CacheWrite = {
                    id: `write-${nextId()}`,
                    timestamp: Date.now(),
                    dataId: options.dataId ?? 'ROOT_QUERY',
                    documentName: documentName(options.query),
                    // TVariables is the caller's own shape; it is always a plain object
                    variables: options.variables as Record<string, unknown> | undefined,
                    result: options.result,
                };
                callbacks.forEach((callback) => callback(write));
            }
            return ref;
        };
        cache.write = wrapped;
        this.restoreCacheWrite = () => {
            cache.write = unwrapped;
        };
    }

    // ============================================================================
    // Apollo Link Methods (Internal)
    // ============================================================================

    /**
     * Internal method to track an operation through the link
     */
    trackOperation(operation: Operation, forward: NextLink): Observable<FetchResult> {
        // Our own introspection query: run it, don't list it
        if (operation.getContext()[INTERNAL_CONTEXT_KEY]) {
            return forward(operation);
        }

        const startTime = Date.now();
        const baseOperationId = `${operation.operationName || 'anonymous'}-${this.operationCounter++}-${startTime}`;

        const operationDef = operation.query.definitions.find(
            (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
        );
        const operationType: OperationType = operationDef?.operation ?? 'query';
        const isSubscription = operationType === 'subscription';

        const base = {
            operationName: operation.operationName || 'Unnamed Operation',
            operationType,
            query: print(operation.query),
            variables: this.config.includeVariables ? operation.variables : undefined,
        };

        // Subscriptions start "active" (listening), queries/mutations start "loading"
        this.notifyOperationCallbacks({
            ...base,
            id: baseOperationId,
            timestamp: startTime,
            status: isSubscription ? 'active' : 'loading',
            ...(isSubscription && { metadata: { isActive: true, eventCount: 0 } }),
        });

        let eventCount = 0;

        return new Observable((observer) => {
            const subscription = forward(operation).subscribe({
                next: (result: FetchResult) => {
                    eventCount++;
                    const eventTime = Date.now();
                    const errors = result.errors?.map(toPlainError);

                    // Subscriptions: one entry per event. Queries/mutations: update the entry
                    this.notifyOperationCallbacks({
                        ...base,
                        ...readHttp(operation, base, result),
                        id: isSubscription ? `${baseOperationId}-event-${eventCount}` : baseOperationId,
                        timestamp: isSubscription ? eventTime : startTime,
                        status: errors ? 'error' : 'success',
                        duration: eventTime - startTime,
                        data: this.config.includeResponseData ? result.data : undefined,
                        errors,
                        error: errors && {
                            ...errors[0],
                            message: errors.map((e) => e.message).join(', '),
                        },
                        ...(isSubscription && {
                            metadata: { parentId: baseOperationId, eventNumber: eventCount, isActive: true },
                        }),
                    });

                    observer.next(result);
                },
                error: (error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);
                    // ServerError/ServerParseError carry the HTTP response
                    const failedResponse =
                        typeof error === 'object' && error !== null && 'response' in error
                            ? (error as { response?: Response }).response
                            : undefined;

                    this.notifyOperationCallbacks({
                        ...base,
                        ...readHttp(operation, base, undefined, failedResponse),
                        id: baseOperationId,
                        timestamp: startTime,
                        status: 'error',
                        duration: Date.now() - startTime,
                        error: { message: message || 'Network error' },
                    });
                    observer.error(error);
                },
                complete: () => {
                    // For subscriptions, emit a final update when they complete/unsubscribe
                    if (isSubscription && eventCount > 0) {
                        this.notifyOperationCallbacks({
                            ...base,
                            id: `${baseOperationId}-completed`,
                            timestamp: Date.now(),
                            status: 'success',
                            duration: Date.now() - startTime,
                            metadata: { parentId: baseOperationId, eventCount, isActive: false, completed: true },
                        });
                    }
                    observer.complete();
                },
            });

            return () => subscription.unsubscribe();
        });
    }

    // ============================================================================
    // Public API Methods
    // ============================================================================

    getCacheSnapshot(): CacheEntry[] {
        try {
            // Extract cache data from Apollo Client
            const cacheData = this.client.cache.extract();
            const entries: CacheEntry[] = [];

            Object.entries(cacheData).forEach(([key, value]) => {
                entries.push({
                    id: key,
                    key: key,
                    typename: (value as any)?.__typename,
                    data: value,
                    timestamp: Date.now(),
                });
            });

            return entries;
        } catch (error) {
            console.error('[Apollo Adapter] Failed to extract cache:', error);
            return [];
        }
    }

    async getSchema(): Promise<GraphQLSchema> {
        try {
            const result = await this.client.query({
                query: gql(getIntrospectionQuery()),
                fetchPolicy: 'network-only',
                context: { [INTERNAL_CONTEXT_KEY]: true },
            });
            return result.data ? toDevtoolSchema(buildClientSchema(result.data)) : { types: [] };
        } catch (error) {
            console.error('[Apollo Adapter] Failed to fetch schema:', error);
            return { types: [] };
        }
    }

    async execute({ query, variables, headers }: {
        query: string;
        variables?: Record<string, unknown>;
        headers?: Record<string, string>;
    }): Promise<Omit<ExecuteResult, 'requestId' | 'duration'>> {
        try {
            const document = parse(query);
            const type = getOperationAST(document)?.operation;
            if (type === 'subscription') {
                return { error: 'Subscriptions can not be run from the Explorer yet.' };
            }
            // Runs through the normal link chain (auth etc.), so it also shows in Operations
            const options = { variables, context: { headers }, errorPolicy: 'all' } as const;
            const result = type === 'mutation'
                ? await this.client.mutate({ mutation: document, ...options })
                : await this.client.query({ query: document, fetchPolicy: 'network-only', ...options });
            return { data: result.data, errors: result.errors?.map(toPlainError) };
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    }

    onOperation(callback: (operation: GraphQLOperation) => void): () => void {
        this.operationCallbacks.add(callback);
        return () => {
            this.operationCallbacks.delete(callback);
        };
    }

    onCacheWrite(callback: (write: CacheWrite) => void): () => void {
        this.cacheCallbacks.add(callback);
        return () => {
            this.cacheCallbacks.delete(callback);
        };
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Helper method to notify all operation callbacks
     */
    private notifyOperationCallbacks(operation: GraphQLOperation): void {
        this.operationCallbacks.forEach((callback) => {
            try {
                callback(operation);
            } catch (error) {
                console.error('[Apollo Adapter] Error in operation callback:', error);
            }
        });
    }
}

/**
 * Helper function to create a Rozenite DevTools Link for Apollo Client.
 * 
 * This link intercepts all GraphQL operations (queries, mutations, subscriptions)
 * and captures their complete lifecycle including request/response data.
 * 
 * **IMPORTANT**: Add this as the FIRST link in your Apollo Client chain to ensure
 * all operations are captured, including duplicates that may be deduplicated later.
 * 
 * @example
 * ```typescript
 * import { ApolloClient, InMemoryCache, ApolloLink, HttpLink } from '@apollo/client';
 * import { apolloGraphqlDevtoolLink, useGraphqlClientDevtool } from 'rozenite-graphql-client-devtool';
 * 
 * // 1. Create the link
 * const rozeniteLink = apolloGraphqlDevtoolLink();
 * 
 * // 2. Add as FIRST link in the chain
 * const client = new ApolloClient({
 *   link: ApolloLink.from([
 *     rozeniteLink,  // Must be first to capture ALL operations
 *     new HttpLink({ uri: 'https://api.example.com/graphql' }),
 *   ]),
 *   cache: new InMemoryCache(),
 * });
 * 
 * // 3. Initialize the devtool in your component
 * function App() {
 *   useGraphqlClientDevtool({
 *     client,
 *     clientType: 'apollo',
 *   });
 *   
 *   return <YourApp />;
 * }
 * ```
 * 
 * @returns ApolloLink instance configured for Rozenite DevTools
 */
export function apolloGraphqlDevtoolLink(): ApolloLink {
    return new ApolloLink((operation: Operation, forward) => {
        // Find the adapter instance from the global registry
        const adapter = (globalThis as any).__ROZENITE_APOLLO_ADAPTER__;

        // Use duck typing instead of instanceof to avoid module bundling issues
        if (adapter && typeof adapter.trackOperation === 'function') {
            // Use the adapter's track operation method
            return adapter.trackOperation(operation, forward);
        }

        // If no adapter found, just pass through (devtool not initialized yet)
        return forward(operation);
    });
}

