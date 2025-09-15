import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { MCPServerRow } from '@/components/MCPServerRow';
import { MCPServer } from '@/types/mcpServer';
import { toolsService } from '@/services/toolsService';
import { Server } from 'lucide-react';

const MCPServers = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      setLoading(true);
      try {
        const tools = await toolsService.getAll();
        
        const serverMap = new Map<string, MCPServer>();
        
        tools.forEach(tool => {
          const serverId = tool.name.split('.')[0];
          const serverName = tool.mcpServer;
          
          if (!serverMap.has(serverId)) {
            serverMap.set(serverId, {
              id: serverId,
              name: serverName,
              status: 'active',
              toolCount: 0,
              description: `MCP server providing various tools and capabilities`,
              version: '1.0.0',
              lastConnected: new Date().toISOString(),
              createdAt: '2024-01-01T10:00:00Z',
              updatedAt: new Date().toISOString()
            });
          }
          
          const server = serverMap.get(serverId)!;
          server.toolCount++;
        });
        
        setServers(Array.from(serverMap.values()));
      } catch (error) {
        console.error('Failed to fetch MCP servers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  const handleDeleteServer = async (serverId: string) => {
    try {
      const tools = await toolsService.getAll();
      const serverTools = tools.filter(tool => tool.name.startsWith(`${serverId}.`));
      
      for (const tool of serverTools) {
        await toolsService.delete(tool.id);
      }
      
      setServers(prev => prev.filter(server => server.id !== serverId));
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    }
  };

  return (
    <CollectionPage
      title="MCP Servers"
      items={servers}
      loading={loading}
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