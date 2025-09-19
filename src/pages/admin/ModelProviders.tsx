import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ModelProviderRow } from '@/components/ModelProviderRow';
import { Database } from 'lucide-react';
import { ModelProvider } from '@/services/modelProvidersService';
import { modelProvidersService } from '@/services/modelProvidersService';

export const ModelProviders = () => {
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    loadModelProviders();
  }, []);

  const loadModelProviders = async () => {
    try {
      setLoading(true);
      const providers = await modelProvidersService.getAll();
      setModelProviders(providers);
    } catch (error) {
      console.error('Failed to load model providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditModelProvider = async (provider: ModelProvider) => {
    console.log('Editing model provider:', provider);
  };

  const handleDeleteModelProvider = async (provider: ModelProvider) => {
    try {
      setOperationLoading(true);
      const success = await modelProvidersService.delete(provider.id);
      if (success) {
        setModelProviders(prev => prev.filter(p => p.id !== provider.id));
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
      items={modelProviders}
      loading={loading}
      operationLoading={operationLoading}
      emptyIcon={<Database className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No model providers configured"
      emptyDescription="Add model providers to enable AI functionality in your system."
      searchPlaceholder="Search model providers..."
      backPath="/admin"
      backLabel="Back to Admin"
      renderItem={(provider) => (
        <ModelProviderRow
          key={provider.id}
          provider={provider}
          onEdit={handleEditModelProvider}
          onDelete={handleDeleteModelProvider}
        />
      )}
    />
  );
};

export default ModelProviders;