import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Tool } from '@/types/tool';
import { toolsService } from '@/services/toolsService';
import { ItemPage } from '@/components/ItemPage';
import { ToolTestingForm } from '@/components/ToolTestingForm';
import { Badge } from '@/components/ui/badge';
import { 
  Wrench, 
  Server,
  Activity
} from 'lucide-react';

export const ToolPage = () => {
  const { id } = useParams<{ id: string }>();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTool(id);
    }
  }, [id]);

  const loadTool = async (toolId: string) => {
    try {
      setLoading(true);
      const toolData = await toolsService.getById(toolId);
      setTool(toolData || null);
    } catch (error) {
      console.error('Error loading tool:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!tool) return null;
    
    switch (tool.status) {
      case 'available':
        return <Badge className="bg-success/10 text-success border-success/20">Available</Badge>;
      case 'unavailable':
        return <Badge variant="secondary">Unavailable</Badge>;
      default:
        return null;
    }
  };

  return (
    <ItemPage
      loading={loading}
      item={tool}
      itemType="Tool"
      backPath="/tools"
      backLabel="Back to Tools"
      icon={<Wrench className="w-8 h-8 text-primary-foreground" />}
      statusBadge={getStatusBadge()}
    >
      {tool && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Server className="w-4 h-4 flex-shrink-0" />
              <span>Server: {tool.serverName}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 text-xs rounded-full bg-background-secondary text-text-secondary">
                {tool.category}
              </span>
            </div>
          </div>

          {/* Tool Details */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">ID</label>
                <p className="text-text-primary font-mono text-sm break-all">{tool.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Server ID</label>
                <p className="text-text-primary font-mono text-sm">{tool.serverId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Server Name</label>
                <p className="text-text-primary">{tool.serverName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Status</label>
                <p className="text-text-primary capitalize">{tool.status}</p>
              </div>
            </div>
          </div>

          {/* Tool Testing */}
          <div className="border-t border-border pt-6 mt-6">
            <ToolTestingForm tool={tool} />
          </div>

          {/* Input Schema */}
          {tool.inputSchema && (
            <div className="border-t border-border pt-6 mt-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Input Schema</h3>
              <div className="bg-background-secondary rounded-lg p-4">
                <pre className="text-sm text-text-primary overflow-x-auto">
                  {JSON.stringify(tool.inputSchema, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </ItemPage>
  );
};

export default ToolPage;