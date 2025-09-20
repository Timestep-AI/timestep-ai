import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Cpu, Calendar, Building2, Globe, Info } from 'lucide-react';
import { Model as ModelType } from '@/types/model';
import { modelsService } from '@/services/modelsService';

export const Model = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [model, setModel] = useState<ModelType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModel = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const foundModel = await modelsService.getById(id);
        setModel(foundModel);
      } catch (error) {
        console.error('Error loading model:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, [id]);

  const handleEdit = () => {
    console.log('Edit not supported - models come from model providers');
  };

  const handleDelete = async () => {
    console.log('Delete not supported - models come from model providers');
  };

  const getStatusBadge = () => {
    return <Badge className="bg-success/10 text-success border-success/20">Available</Badge>;
  };

  return (
    <ItemPage
      loading={loading}
      item={model}
      itemType="Model"
      backPath="/models"
      backLabel="Back to Models"
      icon={<Cpu className="w-8 h-8 text-primary-foreground" />}
      onEdit={handleEdit}
      onDelete={handleDelete}
      statusBadge={getStatusBadge()}
    >
      {model && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Created: {new Date(model.created * 1000).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span>Provider: {model.owned_by}</span>
            </div>

            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>Type: {model.object}</span>
            </div>

            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Cpu className="w-4 h-4 flex-shrink-0" />
              <span>Model ID: {model.id.length > 20 ? `${model.id.substring(0, 20)}...` : model.id}</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Model Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Model Information</h3>
              <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-text-secondary">Full Model ID</label>
                    <p className="text-text-primary font-mono text-sm break-all mt-1">{model.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-secondary">Object Type</label>
                    <p className="text-text-primary mt-1">{model.object}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-secondary">Provider/Owner</label>
                    <p className="text-text-primary mt-1">{model.owned_by}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-secondary">Creation Date</label>
                    <p className="text-text-primary mt-1">{new Date(model.created * 1000).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Capabilities */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Capabilities</h3>
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Text Generation
                  </Badge>
                  <Badge className="bg-success/10 text-success border-success/20">
                    Available
                  </Badge>
                  <Badge variant="outline">
                    API-Based
                  </Badge>
                </div>
              </div>
            </div>

            {/* Provider Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Provider Details</h3>
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{model.owned_by}</p>
                    <p className="text-sm text-text-secondary">
                      This model is provided by {model.owned_by} and accessible through their API
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Usage</h3>
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  This model can be used for text generation, completion, and other AI tasks supported by {model.owned_by}. 
                  It's available through the configured model provider and can be selected when creating agents or running inference tasks.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default Model;