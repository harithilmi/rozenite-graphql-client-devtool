import { useEffect } from 'react';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { pluginId } from '../shared/constants';
import { GraphQLDevToolEventMap } from '../shared/events';
import { LoadingView } from './components/LoadingView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/Tabs';
import { OperationsTab } from './tabs/OperationsTab';
import { CacheTab } from './tabs/CacheTab';
import { ExplorerTab } from './tabs/ExplorerTab';
import { useActions, useClientManagement } from './store/hooks';
import './globals.css';

export default function GraphQLDevToolsPanel() {
  const client = useRozeniteDevToolsClient<GraphQLDevToolEventMap>({
    pluginId: pluginId,
  });

  const { setupClient, cleanupClient } = useClientManagement();
  const { setRecording } = useActions();

  useEffect(() => {
    if (!client) {
      return;
    }

    setupClient(client);
    setRecording(true);

    return () => {
      setRecording(false);
      cleanupClient();
    };
  }, [client, setupClient, cleanupClient, setRecording]);

  if (!client) {
    return <LoadingView />;
  }

  return (
    <Tabs defaultValue="operations" className="flex h-screen flex-col bg-background text-foreground">
      <TabsList>
        <TabsTrigger value="operations">Operations</TabsTrigger>
        <TabsTrigger value="cache">Cache</TabsTrigger>
        <TabsTrigger value="explorer">Explorer</TabsTrigger>
      </TabsList>

      <TabsContent value="operations" className="min-h-0 flex-1">
        <OperationsTab />
      </TabsContent>

      <TabsContent value="cache" className="min-h-0 flex-1">
        <CacheTab />
      </TabsContent>

      <TabsContent value="explorer" className="min-h-0 flex-1">
        <ExplorerTab />
      </TabsContent>
    </Tabs>
  );
}
