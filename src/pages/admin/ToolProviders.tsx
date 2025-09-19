import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { MCPServerRow } from '@/components/MCPServerRow';
import { Settings } from 'lucide-react';
import { MCPServer } from '@/types/mcpServer';
import { mcpServersService } from '@/services/mcpServersService';

export const ToolProviders = () => {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    loadMcpServers();
  }, []);

  const loadMcpServers = async () => {
    try {
      setLoading(true);
      const servers = await mcpServersService.getAll();
      setMcpServers(servers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMcpServer = async (server: MCPServer) => {
    console.log('Editing MCP server:', server);
  };

  const handleDeleteMcpServer = async (serverId: string) => {
    try {
      setOperationLoading(true);
      console.log('Delete functionality needs to be implemented in server for MCP servers');
      // TODO: Implement delete when backend supports it
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <CollectionPage
      title="Tool Providers (MCP Servers)"
      items={mcpServers}
      loading={loading}
      operationLoading={operationLoading}
      emptyIcon={<Settings className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No tool providers configured"
      emptyDescription="Add MCP servers to provide tools and extend system capabilities."
      searchPlaceholder="Search tool providers..."
      backPath="/admin"
      backLabel="Back to Admin"
      renderItem={(server) => (
        <MCPServerRow
          key={server.id}
          server={server}
          onEdit={handleEditMcpServer}
          onDelete={handleDeleteMcpServer}
        />
      )}
    />
  );
};

export default ToolProviders;