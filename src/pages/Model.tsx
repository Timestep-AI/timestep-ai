import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Cpu, Calendar, Zap, DollarSign } from 'lucide-react';
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
    // TODO: Implement edit functionality
    console.log('Edit model:', model);
  };

  const handleDelete = async () => {
    if (!model) return;
    
    try {
      await modelsService.delete(model.id);
      navigate('/models');
    } catch (error) {
      console.error('Error deleting model:', error);
    }
  };

  const getStatusBadge = () => {
    if (!model) return null;
    
    switch (model.status) {
      case 'deprecated':
        return <Badge variant="secondary">Deprecated</Badge>;
      case 'beta':
        return <Badge variant="outline">Beta</Badge>;
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      default:
        return null;
    }
  };

  const formatPrice = (price: number) => {
    if (price < 1) {
      return `$${price.toFixed(2)}`;
    }
    return `$${price.toFixed(0)}`;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Updated: {new Date(model.updatedAt).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {model.provider}
              </Badge>
            </div>
          </div>

          {/* Model Specifications */}
          <div className="border-t border-border pt-6 mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-info" />
                <div>
                  <label className="text-sm font-medium text-text-secondary">Context Length</label>
                  <p className="text-text-primary">{model.contextLength.toLocaleString()} tokens</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <DollarSign className="w-5 h-5 text-success" />
                <div>
                  <label className="text-sm font-medium text-text-secondary">Input Price</label>
                  <p className="text-text-primary">{formatPrice(model.inputPrice)} / 1M tokens</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <DollarSign className="w-5 h-5 text-warning" />
                <div>
                  <label className="text-sm font-medium text-text-secondary">Output Price</label>
                  <p className="text-text-primary">{formatPrice(model.outputPrice)} / 1M tokens</p>
                </div>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div className="border-t border-border pt-6 mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {model.capabilities.map((capability) => (
                <Badge 
                  key={capability} 
                  className="bg-info/10 text-info border-info/20"
                >
                  {capability}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Additional Details */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">ID</label>
                <p className="text-text-primary font-mono text-sm break-all">{model.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Version</label>
                <p className="text-text-primary">{model.version}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Created</label>
                <p className="text-text-primary">{new Date(model.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Status</label>
                <p className="text-text-primary capitalize">{model.status}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default Model;