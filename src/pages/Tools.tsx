import { useState, useEffect } from 'react';
import { Tool } from '@/types/tool';
import { MCPServer } from '@/types/mcpServer';
import { toolsService } from '@/services/toolsService';
import { mcpServersService } from '@/services/mcpServersService';
import { CollectionPage } from '@/components/CollectionPage';
import { ToolRow } from '@/components/ToolRow';
import { MCPServerRow } from '@/components/MCPServerRow';
import { Settings2, Wrench, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

export const Tools = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [serversLoading, setServersLoading] = useState(false);
  const [serversOpen, setServersOpen] = useState(false);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      const toolsData = await toolsService.getAll();
      setTools(toolsData);
    } catch (error) {
      console.error('Error loading tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMcpServers = async () => {
    try {
      setServersLoading(true);
      const servers = await mcpServersService.getAll();
      setMcpServers(servers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setServersLoading(false);
    }
  };

  const handleEditTool = (tool: Tool) => {
    console.log('Edit not supported - tools come from MCP servers');
  };

  const handleDeleteTool = async (toolId: string) => {
    console.log('Delete not supported - tools come from MCP servers');
  };

  const handleEditMcpServer = async (server: MCPServer) => {
    console.log('Editing MCP server:', server);
  };

  const handleDeleteMcpServer = async (serverId: string) => {
    console.log('Delete functionality needs to be implemented in server for MCP servers');
  };

  const handleServersOpen = (open: boolean) => {
    setServersOpen(open);
    if (open && mcpServers.length === 0) {
      loadMcpServers();
    }
  };

  return (
    <div className="relative">
      <CollectionPage
        title="Tools"
        items={tools}
        loading={loading}
        operationLoading={operationLoading}
        emptyIcon={<Wrench className="w-12 h-12 text-text-tertiary" />}
        emptyTitle="No tools found"
        emptyDescription="Get started by creating some default tools or add your own custom tools."
        searchPlaceholder="Search tools..."
        actionButton={
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/tool_providers'}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Tool Providers (MCP Servers)
          </Button>
        }
        renderItem={(tool) => (
          <ToolRow
            key={tool.id}
            tool={tool}
            onEdit={handleEditTool}
            onDelete={handleDeleteTool}
          />
        )}
      />
    </div>
  );
};

export default Tools;