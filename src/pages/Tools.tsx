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
    console.log('Edit tool:', tool);
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      setOperationLoading(true);
      await toolsService.delete(toolId);
      await loadTools();
    } catch (error) {
      console.error('Error deleting tool:', error);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleEditMcpServer = async (server: MCPServer) => {
    console.log('Editing MCP server:', server);
  };

  const handleDeleteMcpServer = async (serverId: string) => {
    try {
      const success = await mcpServersService.delete(serverId);
      if (success) {
        setMcpServers(prev => prev.filter(s => s.id !== serverId));
      }
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    }
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
          <Sheet open={serversOpen} onOpenChange={handleServersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="w-4 h-4 mr-2" />
                Tool Providers (MCP Servers)
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Tool Providers (MCP Servers)</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-4">
                    {serversLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : mcpServers.length === 0 ? (
                      <div className="text-center py-8">
                        <Settings2 className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                        <p className="text-text-tertiary">No tool providers configured</p>
                      </div>
                    ) : (
                      mcpServers.map((server) => (
                        <MCPServerRow
                          key={server.id}
                          server={server}
                          onDelete={handleDeleteMcpServer}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
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