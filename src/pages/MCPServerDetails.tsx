import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Calendar, Hash, Server, Settings } from 'lucide-react';
import { MCPServer } from '@/types/mcpServer';
import { Tool } from '@/types/tool';
import { mcpServersService } from '@/services/mcpServersService';
import { toolsService } from '@/services/toolsService';
import { ToolRow } from '@/components/ToolRow';

const MCPServerDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<MCPServer | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServerAndTools = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [serverData, allTools] = await Promise.all([
          mcpServersService.getById(id),
          toolsService.getAll()
        ]);
        
        setServer(serverData);
        // Filter tools that belong to this MCP server
        console.log('All tools:', allTools);
        console.log('Server ID:', id);
        const serverTools = allTools.filter(tool => tool.serverId === id);
        console.log('Filtered server tools:', serverTools);
        setTools(serverTools);
      } catch (error) {
        console.error('Error loading server and tools:', error);
      } finally {
        setLoading(false);
      }
    };

    loadServerAndTools();
  }, [id]);

  const handleEdit = () => {
    if (server) {
      // Navigate to edit page when available
      console.log('Edit server:', server);
    }
  };

  const handleDelete = async () => {
    if (!server) return;
    
    console.log('Delete button clicked, attempting to delete server:', server.id);
    
    try {
      const result = await mcpServersService.delete(server.id);
      console.log('Delete result:', result);
      navigate('/tool_providers');
    } catch (error) {
      console.error('Error deleting server:', error);
    }
  };

  const handleEditTool = (tool: Tool) => {
    navigate(`/tools/${tool.id}`);
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      await toolsService.delete(toolId);
      const updatedTools = await toolsService.getAll();
      setTools(updatedTools.filter(t => t.serverId === id));
    } catch (error) {
      console.error('Error deleting tool:', error);
    }
  };

  const getStatusBadge = () => {
    if (!server) return null;
    
    return server.enabled 
      ? <Badge className="bg-success/10 text-success border-success/20">Enabled</Badge>
      : <Badge variant="secondary">Disabled</Badge>;
  };

  return (
    <ItemPage
      loading={loading}
      item={server}
      itemType="Tool Provider"
      backPath="/tool_providers"
      backLabel="Back to Tool Providers"
      icon={<Settings className="w-8 h-8 text-primary-foreground" />}
      onEdit={handleEdit}
      onDelete={handleDelete}
      statusBadge={getStatusBadge()}
    >
      {server && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Created: {new Date(server.createdAt).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Hash className="w-4 h-4 flex-shrink-0" />
              <span>{tools.length} tools</span>
            </div>

            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Server className="w-4 h-4 flex-shrink-0" />
              <span>Provider: {server.name}</span>
            </div>
            
            {server.serverUrl && (
              <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span>URL: {new URL(server.serverUrl).hostname}</span>
              </div>
            )}
          </div>

          {/* Tools */}
          <div className="border-t border-border pt-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Tools</h2>
            
            {tools.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="text-4xl text-text-tertiary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No tools found
                </h3>
                <p className="text-text-secondary">
                  This tool provider doesn't have any tools available yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tools.map((tool) => (
                  <ToolRow
                    key={tool.id}
                    tool={tool}
                    onEdit={handleEditTool}
                    onDelete={handleDeleteTool}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default MCPServerDetails;