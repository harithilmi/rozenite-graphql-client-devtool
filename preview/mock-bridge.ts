// Stand-in for @rozenite/plugin-bridge so the panel runs in a plain browser.
// It replays fixture operations as if a React Native app sent them.
import type { RozeniteDevToolsClient, Subscription } from '@rozenite/plugin-bridge';
import type { GraphQLDevToolEventMap } from '../src/shared/events';
import { fixtures } from './fixtures';
import { demoSchema, mockExecute } from './schema';

type EventMap = GraphQLDevToolEventMap;
type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const listeners = new Map<keyof EventMap, Set<Listener<keyof EventMap>>>();

const emit = <K extends keyof EventMap>(type: K, payload: EventMap[K]) => {
  listeners.get(type)?.forEach((listener) => listener(payload));
};

let round = 0;
let writes = 0;

const emitCacheWrite = (documentName: string, result: unknown, variables?: Record<string, unknown>) =>
  emit('cache-write', {
    write: { id: `w${writes++}`, timestamp: Date.now(), dataId: 'ROOT_QUERY', documentName, variables, result },
  });

const replay = () => {
  const now = Date.now();
  round += 1;
  fixtures.operations.forEach(({ operation, pending }, index) => {
    const { data, error, errors, response, duration = 0, ...base } = operation;
    const rest = { ...base, id: `${base.id}-${round}` };
    const timestamp = now - (fixtures.operations.length - index) * 1500;

    // Stagger a little so the list fills like a real session
    setTimeout(() => {
      emit('operation-start', {
        operation: { ...rest, timestamp, status: 'loading' },
      });
      if (pending) return;
      if (operation.status === 'error' && error) {
        emit('operation-error', { id: rest.id, data, error, errors, duration, response });
      } else {
        emit('operation-complete', { id: rest.id, data, errors, duration, response });
        emitCacheWrite(base.operationName, data, rest.variables);
      }
    }, index * 15);
  });
};

const client: RozeniteDevToolsClient<EventMap> = {
  send: (type, payload) => {
    if (type === 'execute-operation') {
      const { requestId, query, variables } = payload as EventMap['execute-operation'];
      const startedAt = Date.now();
      // Small delay so the "Running…" state is visible
      setTimeout(async () => {
        const result = await mockExecute(query, variables);
        emit('execute-result', { requestId, duration: Date.now() - startedAt, ...result });
        if (result.data) emitCacheWrite('Explorer', result.data, variables);
      }, 250);
    }
    if (type === 'get-cache-snapshot') {
      setTimeout(() => emit('cache-snapshot', { entries: fixtures.cache.map((entry) => ({ ...entry, timestamp: Date.now() })) }), 50);
    }
    if (type === 'get-schema') {
      setTimeout(() => emit('schema-loaded', { schema: fixtures.schema.types.length ? fixtures.schema : demoSchema }), 50);
    }
  },
  onMessage: (type, listener): Subscription => {
    const set = listeners.get(type) ?? new Set();
    set.add(listener as Listener<keyof EventMap>);
    listeners.set(type, set);
    return { remove: () => set.delete(listener as Listener<keyof EventMap>) };
  },
  close: () => listeners.clear(),
};

let replayed = false;

export const useRozeniteDevToolsClient = <T extends Record<string, unknown>>(
  _options: { pluginId: string },
) => {
  if (!replayed) {
    replayed = true;
    // Wait for the panel to subscribe before sending anything
    setTimeout(replay, 100);
  }
  return client as unknown as RozeniteDevToolsClient<T>;
};

// Press "r" to send the fixture set again (handy when testing clear/filters)
window.addEventListener('keydown', (event) => {
  if (event.key === 'r' && !(event.target instanceof HTMLElement && event.target.closest('input, textarea'))) replay();
});
