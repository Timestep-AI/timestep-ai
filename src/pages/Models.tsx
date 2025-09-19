import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ModelRow } from '@/components/ModelRow';
import { ModelProviderRow } from '@/components/ModelProviderRow';
import { Cpu, Settings2 } from 'lucide-react';
import { Model } from '@/types/model';
import { ModelProvider } from '@/services/modelProvidersService';
import { modelsService } from '@/services/modelsService';
import { modelProvidersService } from '@/services/modelProvidersService';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

export const Models = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);

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

  const loadModelProviders = async () => {
    try {
      setProvidersLoading(true);
      const providers = await modelProvidersService.getAll();
      setModelProviders(providers);
    } catch (error) {
      console.error('Failed to load model providers:', error);
    } finally {
      setProvidersLoading(false);
    }
  };

  const handleEditModel = async (model: Model) => {
    console.log('Edit not implemented - models come from model providers');
  };

  const handleDeleteModel = async (model: Model) => {
    console.log('Delete not implemented - models come from model providers');
  };

  const handleEditModelProvider = async (provider: ModelProvider) => {
    console.log('Editing model provider:', provider);
  };

  const handleDeleteModelProvider = async (provider: ModelProvider) => {
    try {
      const success = await modelProvidersService.delete(provider.id);
      if (success) {
        setModelProviders(prev => prev.filter(p => p.id !== provider.id));
      }
    } catch (error) {
      console.error('Failed to delete model provider:', error);
    }
  };

  const handleProvidersOpen = (open: boolean) => {
    setProvidersOpen(open);
    if (open && modelProviders.length === 0) {
      loadModelProviders();
    }
  };

  return (
    <div className="relative">
      <CollectionPage
        title="Models"
        items={models}
        loading={loading}
        operationLoading={operationLoading}
        emptyIcon={<Cpu className="w-8 h-8 text-text-tertiary" />}
        emptyTitle="No models yet"
        emptyDescription="Create your first AI model configuration to get started."
        searchPlaceholder="Search models..."
        actionButton={
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/admin/model_providers'}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Model Providers
          </Button>
        }
        renderItem={(model) => (
          <ModelRow
            key={model.id}
            model={model}
            onEdit={handleEditModel}
            onDelete={handleDeleteModel}
          />
        )}
      />
    </div>
  );
};

export default Models;