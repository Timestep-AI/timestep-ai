import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Trash2, Settings, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModelProvider {
  id: string;
  provider: string;
  base_url: string;
  models_url: string;
  api_key?: string;
  created_at: string;
  updated_at: string;
}

export const ModelProvidersSection = () => {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadModelProviders();
  }, []);

  const loadModelProviders = async () => {
    try {
      setLoading(true);
      // This would typically fetch from your backend or Supabase
      // For now, using mock data since the table might not exist yet
      const mockProviders: ModelProvider[] = [
        {
          id: '1',
          provider: 'OpenAI',
          base_url: 'https://api.openai.com/v1',
          models_url: 'https://api.openai.com/v1/models',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          provider: 'Anthropic',
          base_url: 'https://api.anthropic.com/v1',
          models_url: 'https://api.anthropic.com/v1/models',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ];
      setProviders(mockProviders);
    } catch (error) {
      console.error('Error loading model providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // This would typically delete from your backend
      setProviders(prev => prev.filter(provider => provider.id !== id));
    } catch (error) {
      console.error('Error deleting model provider:', error);
    }
  };

  const getProviderStatus = (provider: ModelProvider) => {
    return provider.api_key ? 'configured' : 'not-configured';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Model Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-text-secondary mt-2">Loading model providers...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Model Providers
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/settings/model-providers')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View All
            </Button>
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Provider
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">No Model Providers</h3>
            <p className="text-text-secondary mb-4">
              Configure your first model provider to access AI models.
            </p>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Provider
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {providers.slice(0, 3).map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium text-text-primary">{provider.provider}</h4>
                    <Badge 
                      variant={getProviderStatus(provider) === 'configured' ? 'default' : 'secondary'}
                    >
                      {getProviderStatus(provider) === 'configured' ? 'Configured' : 'Not Configured'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-text-secondary">
                    <p><span className="font-medium">Base URL:</span> {provider.base_url}</p>
                    <p><span className="font-medium">Models URL:</span> {provider.models_url}</p>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    Created {new Date(provider.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-text-secondary hover:text-text-primary"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(provider.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {providers.length > 3 && (
              <div className="text-center pt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/settings/model-providers')}
                >
                  View all {providers.length} providers
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};