import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { MCPServerRow } from '@/components/MCPServerRow';
import { MCPServer } from '@/types/mcpServer';
import { mcpServersService } from '@/services/mcpServersService';
import { Server } from 'lucide-react';

const MCPServers = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      const servers = await mcpServersService.getAll();
      setServers(servers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      const success = await mcpServersService.delete(serverId);
      if (success) {
        setServers(prev => prev.filter(server => server.id !== serverId));
      }
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    }
  };

  return (
    <CollectionPage
      title="MCP Servers"
      items={servers}
      loading={loading}
      backPath="/settings"
      backLabel="Back to Settings"
      emptyIcon={<Server className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No MCP servers"
      emptyDescription="Get started by creating default MCP servers with built-in tools."
      searchPlaceholder="Search MCP servers..."
      renderItem={(server) => (
        <MCPServerRow 
          key={server.id} 
          server={server} 
          onDelete={handleDeleteServer}
        />
      )}
    />
  );
};

export default MCPServers;