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
    } finally {
      setLoading(false);
    }
  };


  const handleEditModel = async (model: Model) => {
    console.log('Editing model:', model);
  };

  const handleDeleteModel = async (model: Model) => {
    try {
      setOperationLoading(true);
      const success = await modelsService.delete(model.id);
      if (success) {
        setModels(prevModels => prevModels.filter(m => m.id !== model.id));
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
    } finally {
      setOperationLoading(false);
    }
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
      renderItem={(model) => (
        <ModelRow
          key={model.id}
          model={model}
          onEdit={handleEditModel}
          onDelete={handleDeleteModel}
        />
      )}
    />
  );
};

export default Models;