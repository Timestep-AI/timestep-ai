import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Server, Globe, Activity, Wrench } from 'lucide-react';
import { MCPServer } from '@/types/mcpServer';
import { mcpServersService } from '@/services/mcpServersService';
import { Tool } from '@/types/tool';
import { toolsService } from '@/services/toolsService';
import { ToolRow } from '@/components/ToolRow';
import { Skeleton } from '@/components/ui/skeleton';

const ToolProviderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<MCPServer | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadServerAndTools(id);
    }
  }, [id]);

  const loadServerAndTools = async (serverId: string) => {
    try {
      setLoading(true);
      const [serverData, allTools] = await Promise.all([
        mcpServersService.getById(serverId),
        toolsService.getAll()
      ]);
      
      setServer(serverData);
      // Filter tools by server ID
      const serverTools = allTools.filter(tool => tool.serverId === serverId);
      setTools(serverTools);
    } catch (error) {
      console.error('Failed to load server details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTool = (tool: Tool) => {
    console.log('Edit not supported - tools come from MCP servers');
  };

  const handleDeleteTool = async (toolId: string) => {
    console.log('Delete not supported - tools come from MCP servers');
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!server) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/admin/tool_providers'}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tool Providers
            </Button>
          </div>
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Server className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Tool provider not found</h3>
                <p className="text-text-tertiary">The requested tool provider could not be found.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/admin/tool_providers'}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tool Providers
          </Button>
        </div>

        {/* Server Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Server className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{server.name}</CardTitle>
                  <CardDescription className="flex items-center space-x-2">
                    {server.serverUrl && (
                      <>
                        <Globe className="w-4 h-4" />
                        <span>{new URL(server.serverUrl).hostname}</span>
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant={server.enabled ? 'default' : 'secondary'}
                className="flex items-center space-x-1"
              >
                <Activity className="w-3 h-3" />
                <span>{server.enabled ? 'Enabled' : 'Disabled'}</span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {server.description && (
                <div>
                  <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                    Description
                  </h4>
                  <p className="text-sm">{server.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                    Status
                  </h4>
                  <p className="text-sm">{server.enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                    Server ID
                  </h4>
                  <p className="text-sm font-mono">{server.id.slice(0, 8)}...</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                    Tools Available
                  </h4>
                  <p className="text-sm">{tools.length} tools</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Associated Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Wrench className="w-5 h-5 mr-2" />
              Associated Tools ({tools.length})
            </CardTitle>
            <CardDescription>
              Tools provided by this MCP server
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <div className="text-center py-8">
                <Wrench className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                <p className="text-text-tertiary">No tools found for this provider</p>
              </div>
            ) : (
              <div className="space-y-4">
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
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ToolProviderDetails;