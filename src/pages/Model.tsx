import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Cpu, Calendar } from 'lucide-react';
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
      statusBadge={null}
    >
      {model && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Created: {new Date(model.created * 1000).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {model.owned_by}
              </Badge>
            </div>
          </div>
          
          {/* Model Details */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">ID</label>
                <p className="text-text-primary font-mono text-sm break-all">{model.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Object Type</label>
                <p className="text-text-primary">{model.object}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Owner</label>
                <p className="text-text-primary">{model.owned_by}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Created</label>
                <p className="text-text-primary">{new Date(model.created * 1000).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default Model;