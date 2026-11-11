import { createStore } from 'zustand';
import type { GraphQLDevToolsClient, GraphQLDevToolEventMap } from '../../shared/events';
import type {
  CacheEntry,
  CacheWrite,
  ExecuteResult,
  GraphQLOperation,
  GraphQLSchema,
} from '../../shared/types';

const MAX_OPERATIONS = 1000;
const MAX_CACHE_WRITES = 500;

export interface ExplorerDraft {
  query: string;
  variables: string;
  headers: string;
}

export interface GraphQLDevToolsState {
  isRecording: boolean;
  selectedOperationId: string | null;
  operations: Map<string, GraphQLOperation>;
  cacheEntries: Map<string, CacheEntry>;
  cacheWrites: CacheWrite[];
  isRecordingCacheWrites: boolean;
  schema: GraphQLSchema | null;
  /** Explorer editor content, kept here so it survives tab switches */
  explorer: ExplorerDraft;
  execution: { requestId: string; startedAt: number; result?: ExecuteResult } | null;

  _client?: GraphQLDevToolsClient;
  _subscriptions: Array<{ remove: () => void }>;

  actions: {
    setRecording: (isRecording: boolean) => void;
    setSelectedOperation: (operationId: string | null) => void;
    clearOperations: () => void;
    requestCacheSnapshot: () => void;
    requestSchema: () => void;
    setRecordingCacheWrites: (isRecording: boolean) => void;
    clearCacheWrites: () => void;
    setExplorerDraft: (patch: Partial<ExplorerDraft>) => void;
    execute: (request: { query: string; variables?: Record<string, unknown>; headers?: Record<string, string> }) => void;
  };

  client: {
    setupClient: (client: GraphQLDevToolsClient) => void;
    cleanupClient: () => void;
  };
}

type Incoming = Pick<
  GraphQLDevToolEventMap,
  | 'operation-start'
  | 'operation-update'
  | 'operation-complete'
  | 'operation-error'
  | 'cache-snapshot'
  | 'cache-write'
  | 'schema-loaded'
  | 'execute-result'
>;

export const createGraphQLDevToolsStore = () =>
  createStore<GraphQLDevToolsState>()((set, get) => {
    const send = <K extends keyof GraphQLDevToolEventMap>(type: K, payload: GraphQLDevToolEventMap[K]) =>
      get()._client?.send(type, payload);

    /** Apply a change to one operation, if we still have it */
    const patchOperation = (id: string, patch: Partial<GraphQLOperation>) =>
      set((state) => {
        const operation = state.operations.get(id);
        if (!operation) return state;
        const operations = new Map(state.operations);
        operations.set(id, { ...operation, ...patch });
        return { operations };
      });

    // Cache writes come in bursts (one per query result); refresh the snapshot once per burst
    let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshCacheSoon = () => {
      clearTimeout(snapshotTimer);
      snapshotTimer = setTimeout(() => send('get-cache-snapshot', {}), 250);
    };

    const handlers: { [K in keyof Incoming]: (payload: Incoming[K]) => void } = {
      'operation-start': ({ operation }) =>
        set((state) => {
          const operations = new Map(state.operations);
          // Drop the oldest entry once the limit is hit (Map keeps insertion order)
          if (operations.size >= MAX_OPERATIONS) {
            const oldest = operations.keys().next().value;
            if (oldest) operations.delete(oldest);
          }
          operations.set(operation.id, operation);
          return { operations };
        }),
      'operation-update': ({ id, updates }) => patchOperation(id, updates),
      'operation-complete': ({ id, ...result }) => patchOperation(id, { ...result, status: 'success' }),
      'operation-error': ({ id, ...result }) => patchOperation(id, { ...result, status: 'error' }),
      'cache-snapshot': ({ entries }) =>
        set({ cacheEntries: new Map(entries.map((entry) => [entry.id, entry])) }),
      'cache-write': ({ write }) => {
        refreshCacheSoon();
        if (!get().isRecordingCacheWrites) return;
        set((state) => ({ cacheWrites: [write, ...state.cacheWrites].slice(0, MAX_CACHE_WRITES) }));
      },
      'schema-loaded': ({ schema }) => set({ schema }),
      'execute-result': (result) =>
        set((state) =>
          state.execution?.requestId === result.requestId
            ? { execution: { ...state.execution, result } }
            : state,
        ),
    };

    return {
      isRecording: true,
      selectedOperationId: null,
      operations: new Map(),
      cacheEntries: new Map(),
      cacheWrites: [],
      isRecordingCacheWrites: true,
      schema: null,
      explorer: { query: '', variables: '{}', headers: '{}' },
      execution: null,
      _subscriptions: [],

      actions: {
        setRecording: (isRecording) => {
          send(isRecording ? 'graphql-enable' : 'graphql-disable', {});
          set({ isRecording });
        },
        setSelectedOperation: (selectedOperationId) => set({ selectedOperationId }),
        clearOperations: () => {
          send('clear-operations', {});
          set({ operations: new Map(), selectedOperationId: null });
        },
        requestCacheSnapshot: () => send('get-cache-snapshot', {}),
        requestSchema: () => send('get-schema', {}),
        setRecordingCacheWrites: (isRecordingCacheWrites) => set({ isRecordingCacheWrites }),
        clearCacheWrites: () => set({ cacheWrites: [] }),
        setExplorerDraft: (patch) => set((state) => ({ explorer: { ...state.explorer, ...patch } })),
        execute: (request) => {
          const requestId = `run-${Date.now()}`;
          set({ execution: { requestId, startedAt: Date.now() } });
          send('execute-operation', { requestId, ...request });
        },
      },

      client: {
        setupClient: (client) => {
          // Each key's handler matches its payload; TS can't follow that through the loop
          const subscriptions = (Object.keys(handlers) as Array<keyof Incoming>).map((type) =>
            client.onMessage(type, handlers[type] as (payload: Incoming[typeof type]) => void),
          );
          set({ _subscriptions: subscriptions, _client: client });
          // Schema is requested when the Explorer tab opens (it fires an introspection query)
          client.send('get-cache-snapshot', {});
        },
        cleanupClient: () => {
          clearTimeout(snapshotTimer);
          get()._subscriptions.forEach((subscription) => subscription.remove());
          get()._client?.send('graphql-disable', {});
          set({ _subscriptions: [], _client: undefined });
        },
      },
    };
  });

export const store = createGraphQLDevToolsStore();
