import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ApiKeyRow } from '@/components/ApiKeyRow';
import { Key } from 'lucide-react';
import { ApiKey, apiKeysService } from '@/services/apiKeysService';

export const ApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const keys = await apiKeysService.getAll();
      setApiKeys(keys);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditApiKey = async (apiKey: ApiKey) => {
    console.log('Editing API key:', apiKey);
  };

  const handleDeleteApiKey = async (apiKey: ApiKey) => {
    try {
      setOperationLoading(true);
      const success = await apiKeysService.delete(apiKey.id);
      if (success) {
        setApiKeys(prevKeys => prevKeys.filter(k => k.id !== apiKey.id));
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <CollectionPage
      title="API Keys"
      items={apiKeys}
      loading={loading}
      operationLoading={operationLoading}
      backPath="/settings"
      backLabel="Back to Settings"
      emptyIcon={<Key className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No API keys yet"
      emptyDescription="Add your first API key to start using AI models and services."
      searchPlaceholder="Search API keys..."
      renderItem={(apiKey) => (
        <ApiKeyRow
          key={apiKey.id}
          apiKey={apiKey}
          onEdit={handleEditApiKey}
          onDelete={handleDeleteApiKey}
        />
      )}
    />
  );
};

export default ApiKeys;