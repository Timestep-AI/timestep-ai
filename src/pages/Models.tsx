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
          <Sheet open={providersOpen} onOpenChange={handleProvidersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="w-4 h-4 mr-2" />
                Model Providers
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Model Providers</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-4">
                    {providersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : modelProviders.length === 0 ? (
                      <div className="text-center py-8">
                        <Settings2 className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                        <p className="text-text-tertiary">No model providers configured</p>
                      </div>
                    ) : (
                      modelProviders.map((provider) => (
                        <ModelProviderRow
                          key={provider.id}
                          provider={provider}
                          onEdit={handleEditModelProvider}
                          onDelete={handleDeleteModelProvider}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
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