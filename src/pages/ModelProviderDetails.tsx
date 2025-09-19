import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ModelRow } from '@/components/ModelRow';
import { modelsService } from '@/services/modelsService';
import { modelProvidersService } from '@/services/modelProvidersService';
import { Model } from '@/types/model';
import { ModelProvider } from '@/services/modelProvidersService';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2 } from 'lucide-react';

const ModelProviderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [models, setModels] = useState<Model[]>([]);
  const [provider, setProvider] = useState<ModelProvider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviderAndModels = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Fetch all providers and find the one with matching ID
        const allProviders = await modelProvidersService.getAll();
        const providerData = allProviders.find(p => p.id === id);
        setProvider(providerData || null);

        // Fetch all models and filter by provider
        if (providerData) {
          const allModels = await modelsService.getAll();
          const providerModels = allModels.filter(model => 
            model.owned_by === providerData.provider
          );
          setModels(providerModels);
        }
      } catch (error) {
        console.error('Failed to fetch model provider details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviderAndModels();
  }, [id]);

  const handleEditModel = (model: Model) => {
    // Navigate to model details page
    navigate(`/models/${model.id}`);
  };

  const handleDeleteModel = async (model: Model) => {
    console.log('Delete not supported - models come from model providers');
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!provider) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">Provider not found</h3>
            <p className="text-text-secondary">The requested model provider could not be found.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/models')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Models
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{provider.provider}</h1>
            <p className="text-text-secondary">{provider.base_url}</p>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Models ({models.length})
          </h2>
          <p className="text-text-secondary text-sm">
            All models provided by {provider.provider}
          </p>
        </div>

        {models.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No models found</h3>
            <p className="text-text-secondary">This provider doesn't have any models available yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {models.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                onEdit={handleEditModel}
                onDelete={handleDeleteModel}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ModelProviderDetails;