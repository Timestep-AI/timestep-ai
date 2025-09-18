import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ModelProviderRow } from '@/components/ModelProviderRow';
import { Building2 } from 'lucide-react';
import { ModelProvider, modelProvidersService } from '@/services/modelProvidersService';

export const ModelProviders = () => {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const providersList = await modelProvidersService.getAll();
      setProviders(providersList);
    } catch (error) {
      console.error('Failed to load model providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProvider = async (provider: ModelProvider) => {
    console.log('Editing model provider:', provider);
  };

  const handleDeleteProvider = async (provider: ModelProvider) => {
    try {
      setOperationLoading(true);
      const success = await modelProvidersService.delete(provider.id);
      if (success) {
        setProviders(prevProviders => prevProviders.filter(p => p.id !== provider.id));
      }
    } catch (error) {
      console.error('Failed to delete model provider:', error);
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <CollectionPage
      title="Model Providers"
      items={providers}
      loading={loading}
      operationLoading={operationLoading}
      backPath="/settings"
      backLabel="Back to Settings"
      emptyIcon={<Building2 className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No model providers yet"
      emptyDescription="Configure your first model provider to access AI models."
      searchPlaceholder="Search model providers..."
      renderItem={(provider) => (
        <ModelProviderRow
          key={provider.id}
          provider={provider}
          onEdit={handleEditProvider}
          onDelete={handleDeleteProvider}
        />
      )}
    />
  );
};

export default ModelProviders;