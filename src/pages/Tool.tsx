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

  return (
    <ItemPage
      loading={loading}
      item={tool}
      itemType="Tool"
      backPath="/tools"
      backLabel="Back to Tools"
      icon={<Wrench className="w-8 h-8 text-primary-foreground" />}
      statusBadge={null}
    >
      {tool && (
        <>
          {/* Tool Testing */}
          <div className="border-t border-border pt-6 mt-6">
            <ToolTestingForm tool={tool} />
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default ToolPage;