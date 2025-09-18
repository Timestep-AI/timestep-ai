import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Plus, Trash2, ExternalLink } from 'lucide-react';
import { MCPServer } from '@/types/mcpServer';
import { useNavigate } from 'react-router-dom';

export const McpServersSection = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadMcpServers();
  }, []);

  const loadMcpServers = async () => {
    try {
      setLoading(true);
      // Mock data for MCP servers - this would typically come from your service
      const mockServers: MCPServer[] = [
        {
          id: '1',
          name: 'Built-in MCP Server',
          description: 'Built-in server providing essential tools',
          status: 'active',
          toolCount: 5,
          version: '1.0.0',
          lastConnected: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Custom MCP Server',
          description: 'Custom server for specialized tools',
          status: 'inactive',
          toolCount: 3,
          version: '1.2.0',
          lastConnected: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];
      setServers(mockServers);
    } catch (error) {
      console.error('Error loading MCP servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setServers(prev => prev.filter(server => server.id !== id));
    } catch (error) {
      console.error('Error deleting MCP server:', error);
    }
  };

  const getStatusBadge = (status: MCPServer['status']) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      error: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            MCP Servers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-text-secondary mt-2">Loading MCP servers...</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            MCP Servers
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/settings/mcp_servers')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View All
            </Button>
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Server
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {servers.length === 0 ? (
          <div className="text-center py-8">
            <Server className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">No MCP Servers</h3>
            <p className="text-text-secondary mb-4">
              Configure your first MCP server to access additional tools and capabilities.
            </p>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Server
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {servers.slice(0, 3).map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/settings/mcp_servers/${server.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium text-text-primary">{server.name}</h4>
                    {getStatusBadge(server.status)}
                  </div>
                  <div className="space-y-1 text-sm text-text-secondary">
                    <p><span className="font-medium">Tools:</span> {server.toolCount}</p>
                    <p><span className="font-medium">Version:</span> {server.version}</p>
                    <p className="text-text-tertiary">{server.description}</p>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    Created {new Date(server.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(server.id);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {servers.length > 3 && (
              <div className="text-center pt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/settings/mcp_servers')}
                >
                  View all {servers.length} servers
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};