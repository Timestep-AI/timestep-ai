import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { MCPServerRow } from '@/components/MCPServerRow';
import { Settings } from 'lucide-react';
import { MCPServer } from '@/types/mcpServer';
import { mcpServersService } from '@/services/mcpServersService';

export const ToolProviders = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToolProviders = async () => {
      try {
        setLoading(true);
        const fetchedServers = await mcpServersService.getAll();
        setServers(fetchedServers);
      } catch (error) {
        console.error('Error loading tool providers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadToolProviders();
  }, []);

  const handleEdit = (server: MCPServer) => {
    console.log('Edit tool provider:', server);
  };

  const handleDelete = async (serverId: string) => {
    try {
      await mcpServersService.delete(serverId);
      const updatedServers = await mcpServersService.getAll();
      setServers(updatedServers);
    } catch (error) {
      console.error('Error deleting tool provider:', error);
    }
  };

  return (
    <CollectionPage
      title="Tool Providers"
      items={servers}
      loading={loading}
      emptyIcon={<Settings className="text-4xl text-text-tertiary" />}
      emptyTitle="No tool providers found"
      emptyDescription="Get started by configuring your first tool provider."
      searchPlaceholder="Search tool providers..."
      renderItem={(server) => (
        <MCPServerRow
          key={server.id}
          server={server}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    />
  );
};

export default ToolProviders;