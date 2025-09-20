import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ModelProviderRow } from '@/components/ModelProviderRow';
import { EditModelProviderDialog } from '@/components/EditModelProviderDialog';
import { Server } from 'lucide-react';
import { modelProvidersService, type ModelProvider } from '@/services/modelProvidersService';
import { toast } from 'sonner';

export const ModelProviders = () => {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        const fetchedProviders = await modelProvidersService.getAll();
        setProviders(fetchedProviders);
      } catch (error) {
        console.error('Error loading model providers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  const handleEdit = (provider: ModelProvider) => {
    setEditingProvider(provider);
    setEditDialogOpen(true);
  };

  const handleSave = async (id: string, updates: Partial<ModelProvider>) => {
    try {
      await modelProvidersService.update(id, updates);
      const updatedProviders = await modelProvidersService.getAll();
      setProviders(updatedProviders);
      toast.success('Model provider updated successfully');
    } catch (error) {
      console.error('Error updating model provider:', error);
      toast.error('Failed to update model provider');
      throw error;
    }
  };

  const handleDelete = async (provider: ModelProvider) => {
    try {
      await modelProvidersService.delete(provider.id);
      const updatedProviders = await modelProvidersService.getAll();
      setProviders(updatedProviders);
    } catch (error) {
      console.error('Error deleting model provider:', error);
    }
  };

  return (
    <>
      <CollectionPage
        title="Model Providers"
        items={providers}
        loading={loading}
        emptyIcon={<Server className="text-4xl text-text-tertiary" />}
        emptyTitle="No model providers found"
        emptyDescription="Get started by configuring your first model provider."
        searchPlaceholder="Search model providers..."
        renderItem={(provider) => (
          <ModelProviderRow
            key={provider.id}
            provider={provider}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      />
      
      <EditModelProviderDialog
        provider={editingProvider}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSave}
      />
    </>
  );
};

export default ModelProviders;