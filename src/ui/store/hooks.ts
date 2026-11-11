import { useStore } from 'zustand';
import { store, type GraphQLDevToolsState } from './store';

const select = <T,>(selector: (state: GraphQLDevToolsState) => T) => () => useStore(store, selector);

export const useIsRecording = select((state) => state.isRecording);
export const useSelectedOperationId = select((state) => state.selectedOperationId);
export const useOperations = select((state) => state.operations);
export const useCacheEntries = select((state) => state.cacheEntries);
export const useCacheWrites = select((state) => state.cacheWrites);
export const useIsRecordingCacheWrites = select((state) => state.isRecordingCacheWrites);
export const useSchema = select((state) => state.schema);
export const useExplorerDraft = select((state) => state.explorer);
export const useExecution = select((state) => state.execution);
export const useActions = select((state) => state.actions);
export const useClientManagement = select((state) => state.client);
