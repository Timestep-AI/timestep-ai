import { useState, useEffect } from 'react';
import { Tool } from '@/types/tool';
import { toolsService } from '@/services/toolsService';
import { CollectionPage } from '@/components/CollectionPage';
import { ToolRow } from '@/components/ToolRow';
import { CreateDefaultsButton } from '@/components/CreateDefaultsButton';
import { Plus, Wrench } from 'lucide-react';

export const Tools = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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
      showToastMessage('Error loading tools');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaults = async () => {
    try {
      setOperationLoading(true);
      await toolsService.createDefaults();
      await loadTools();
      showToastMessage('Default tools created successfully!');
    } catch (error) {
      console.error('Error creating default tools:', error);
      showToastMessage('Error creating default tools');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setOperationLoading(true);
      await toolsService.deleteAll();
      await loadTools();
      showToastMessage('All tools deleted successfully!');
    } catch (error) {
      console.error('Error deleting all tools:', error);
      showToastMessage('Error deleting tools');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleEditTool = (tool: Tool) => {
    // TODO: Implement edit functionality
    console.log('Edit tool:', tool);
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      setOperationLoading(true);
      await toolsService.delete(toolId);
      await loadTools();
      showToastMessage('Tool deleted successfully!');
    } catch (error) {
      console.error('Error deleting tool:', error);
      showToastMessage('Error deleting tool');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleCreateTool = async () => {
    // TODO: Implement create functionality
    console.log('Create new tool');
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
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
      showSearch={true}
      showCreateButton={true}
      itemCountLabel={(count) => `${count} tool${count !== 1 ? 's' : ''}`}
      onCreateDefaults={handleCreateDefaults}
      onDeleteAll={handleDeleteAll}
      onCreate={handleCreateTool}
      renderItem={(tool) => (
        <ToolRow
          key={tool.id}
          tool={tool}
          onEdit={handleEditTool}
          onDelete={handleDeleteTool}
        />
      )}
      showToast={showToast}
      toastMessage={toastMessage}
    />
  );
};

export default Tools;