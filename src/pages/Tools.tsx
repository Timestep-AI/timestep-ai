import { useState, useEffect } from 'react';
import { Tool } from '@/types/tool';
import { toolsService } from '@/services/toolsService';
import { CollectionPage } from '@/components/CollectionPage';
import { ToolRow } from '@/components/ToolRow';
import { Plus, Wrench } from 'lucide-react';

export const Tools = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

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

  const handleDeleteAll = async () => {
    try {
      setOperationLoading(true);
      await toolsService.deleteAll();
      await loadTools();
    } catch (error) {
      console.error('Error deleting all tools:', error);
    } finally {
      setOperationLoading(false);
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

  return (
    <CollectionPage
      title="Tools"
      items={tools}
      loading={loading}
      operationLoading={operationLoading}
      emptyIcon={<Wrench className="w-12 h-12 text-text-tertiary" />}
      emptyTitle="No tools found"
      emptyDescription="Get started by creating some default tools or add your own custom tools."
      searchPlaceholder="Search tools..."
      onDeleteAll={handleDeleteAll}
      showDeleteAll={true}
      renderItem={(tool) => (
        <ToolRow
          key={tool.id}
          tool={tool}
          onEdit={handleEditTool}
          onDelete={handleDeleteTool}
        />
      )}
    />
  );
};

export default Tools;