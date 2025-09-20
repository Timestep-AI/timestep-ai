import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ModelRow } from '@/components/ModelRow';
import { EditModelProviderDialog } from '@/components/EditModelProviderDialog';
import { modelsService } from '@/services/modelsService';
import { modelProvidersService } from '@/services/modelProvidersService';
import { Model } from '@/types/model';
import { ModelProvider } from '@/services/modelProvidersService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Building2, Globe, CheckCircle, XCircle, Calendar, Cpu, Link, Edit } from 'lucide-react';
import { toast } from 'sonner';

const ModelProviderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [models, setModels] = useState<Model[]>([]);
  const [provider, setProvider] = useState<ModelProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    const fetchProviderAndModels = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Fetch provider by ID using the service method
        const providerData = await modelProvidersService.getById(id);
        console.log('Provider data received:', providerData);
        setProvider(providerData);

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

  const handleSaveProvider = async (id: string, updates: Partial<ModelProvider>) => {
    try {
      console.log('Saving provider updates:', updates);
      const savedProvider = await modelProvidersService.update(id, updates);
      console.log('Saved provider response:', savedProvider);
      
      // If API key was provided in the update, assume it was saved successfully
      // and update the local state to reflect that
      if (updates.apiKey && provider) {
        const updatedProvider = { 
          ...provider, 
          ...savedProvider,
          apiKey: updates.apiKey // Set this locally since API won't return it
        };
        console.log('Updated provider with API key:', updatedProvider);
        setProvider(updatedProvider);
      } else {
        // Refresh provider data for other updates
        const refreshedProvider = await modelProvidersService.getById(id);
        console.log('Refreshed provider:', refreshedProvider);
        setProvider(refreshedProvider);
      }
      
      toast.success('Model provider updated successfully');
    } catch (error) {
      console.error('Error updating model provider:', error);
      toast.error('Failed to update model provider');
      throw error;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!provider) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/model_providers')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Model Providers
            </Button>
          </div>
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Provider not found</h3>
                <p className="text-text-tertiary">The requested model provider could not be found.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const isConfigured = !!provider.apiKey;
  console.log('Provider apiKey:', provider.apiKey, 'isConfigured:', isConfigured);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/model_providers')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Model Providers
          </Button>
        </div>

        {/* Provider Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{provider.provider}</CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <Globe className="w-4 h-4" />
                      <span>{provider.baseUrl}</span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={isConfigured ? 'default' : 'secondary'}
                  className="flex items-center space-x-1"
                >
                  {isConfigured ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  <span>{isConfigured ? 'Active' : 'Inactive'}</span>
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                  className="flex items-center space-x-1"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                  Status
                </h4>
                <p className="text-sm">
                  {isConfigured ? 'API Key Configured' : 'API Key Not Configured'}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                  Base URL
                </h4>
                <p className="text-sm flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {provider.baseUrl || 'Not configured'}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                  Models URL
                </h4>
                <p className="text-sm flex items-center gap-1">
                  <Link className="w-3 h-3" />
                  {provider.modelsUrl || 'Not configured'}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                  Created
                </h4>
                <p className="text-sm flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(provider.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                  Last Updated
                </h4>
                <p className="text-sm flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(provider.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            {provider.description && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium text-sm text-text-tertiary uppercase tracking-wide mb-1">
                  Description
                </h4>
                <p className="text-sm">{provider.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Associated Models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Cpu className="w-5 h-5 mr-2" />
              Associated Models ({models.length})
            </CardTitle>
            <CardDescription>
              Models provided by {provider.provider}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <div className="text-center py-8">
                <Cpu className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                <p className="text-text-tertiary">No models found for this provider</p>
                <p className="text-sm text-text-tertiary mt-1">
                  Models will appear here once they're discovered from the provider
                </p>
              </div>
            ) : (
              <div className="space-y-4">
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
          </CardContent>
        </Card>
      </div>
      
      <EditModelProviderDialog
        provider={provider}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveProvider}
      />
    </Layout>
  );
};

export default ModelProviderDetails;