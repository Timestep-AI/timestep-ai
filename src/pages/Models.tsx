import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ModelRow } from '@/components/ModelRow';
import { Cpu } from 'lucide-react';
import { Model } from '@/types/model';
import { modelsService } from '@/services/modelsService';

export const Models = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const modelsList = await modelsService.getAll();
      setModels(modelsList);
    } catch (error) {
      console.error('Failed to load models:', error);
      showToastMessage('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaults = async () => {
    try {
      setOperationLoading(true);
      const defaultModels = await modelsService.createDefaults();
      setModels(defaultModels);
      showToastMessage(`Created ${defaultModels.length} default models`);
    } catch (error) {
      console.error('Failed to create default models:', error);
      showToastMessage('Failed to create default models');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setOperationLoading(true);
      await modelsService.deleteAll();
      setModels([]);
      showToastMessage('All models deleted');
    } catch (error) {
      console.error('Failed to delete all models:', error);
      showToastMessage('Failed to delete all models');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleEditModel = async (model: Model) => {
    console.log('Editing model:', model);
    // TODO: Implement edit modal/form
    showToastMessage(`Edit functionality coming soon for ${model.name}`);
  };

  const handleDeleteModel = async (model: Model) => {
    try {
      setOperationLoading(true);
      const success = await modelsService.delete(model.id);
      if (success) {
        setModels(prevModels => prevModels.filter(m => m.id !== model.id));
        showToastMessage(`Deleted ${model.name}`);
      } else {
        showToastMessage('Failed to delete model');
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      showToastMessage('Failed to delete model');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleCreateModel = async () => {
    console.log('Creating new model...');
    // TODO: Implement create modal/form
    showToastMessage('Create functionality coming soon');
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <CollectionPage
      title="Models"
      items={models}
      loading={loading}
      operationLoading={operationLoading}
      emptyIcon={<Cpu className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No models yet"
      emptyDescription="Create your first AI model configuration to get started."
      searchPlaceholder="Search models..."
      itemCountLabel={(count) => `${count} model${count !== 1 ? 's' : ''}`}
      onCreateDefaults={handleCreateDefaults}
      onDeleteAll={handleDeleteAll}
      onCreate={handleCreateModel}
      renderItem={(model) => (
        <ModelRow
          key={model.id}
          model={model}
          onEdit={handleEditModel}
          onDelete={handleDeleteModel}
        />
      )}
      showSearch={true}
      showDeleteAll={true}
      showCreateButton={true}
      toastMessage={toastMessage}
      showToast={showToast}
    />
  );
};

export default Models;