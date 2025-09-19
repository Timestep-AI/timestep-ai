import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ToolRow } from '@/components/ToolRow';
import { toolsService } from '@/services/toolsService';
import { Tool } from '@/types/tool';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Server } from 'lucide-react';

const MCPServerDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServerTools = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const allTools = await toolsService.getAll();
        // Filter tools that belong to this MCP server
        const serverTools = allTools.filter(tool => 
          tool.serverId === id
        );
        setTools(serverTools);
      } catch (error) {
        console.error('Failed to fetch MCP server tools:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServerTools();
  }, [id]);

  const handleEditTool = (tool: Tool) => {
    // Navigate to tool details page
    navigate(`/tools/${tool.id}`);
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      await toolsService.delete(toolId);
      setTools(prev => prev.filter(tool => tool.id !== toolId));
    } catch (error) {
      console.error('Failed to delete tool:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tools')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Server className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">MCP Server</h1>
            <p className="text-text-secondary">Server ID: {id}</p>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Tools ({tools.length})
          </h2>
          <p className="text-text-secondary text-sm">
            All tools provided by this MCP server
          </p>
        </div>

        {tools.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No tools found</h3>
            <p className="text-text-secondary">This MCP server doesn't have any tools registered.</p>
          </div>
        ) : (
          <div className="space-y-2">
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
    </Layout>
  );
};

export default MCPServerDetails;