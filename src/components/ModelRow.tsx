import { Cpu, Calendar, Zap, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CollectionItemRow } from '@/components/CollectionItemRow';
import { Model } from '@/types/model';

interface ModelRowProps {
  model: Model;
  onEdit?: (model: Model) => void;
  onDelete?: (model: Model) => void;
}

export const ModelRow = ({ model, onEdit, onDelete }: ModelRowProps) => {
  const navigate = useNavigate();

  const getStatusBadge = () => {
    switch (model.status) {
      case 'deprecated':
        return <Badge variant="secondary" className="text-xs flex-shrink-0">Deprecated</Badge>;
      case 'beta':
        return <Badge variant="outline" className="text-xs flex-shrink-0">Beta</Badge>;
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20 text-xs flex-shrink-0">Active</Badge>;
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

  const metadata = [
    {
      icon: <Calendar className="w-3 h-3 flex-shrink-0" />,
      text: `Updated: ${new Date(model.updatedAt).toLocaleDateString()}`
    },
    ...(model.contextLength ? [{
      icon: <Zap className="w-3 h-3 flex-shrink-0" />,
      text: `${model.contextLength.toLocaleString()} tokens`
    }] : []),
    ...(model.inputPrice != null && model.outputPrice != null ? [{
      icon: <DollarSign className="w-3 h-3 flex-shrink-0" />,
      text: `${formatPrice(model.inputPrice)}/${formatPrice(model.outputPrice)} per 1M tokens`
    }] : [])
  ];

  const rightContent = (
    <div className="flex flex-col items-end space-y-1">
      <Badge variant="outline" className="text-xs">
        {model.provider}
      </Badge>
      {model.capabilities && model.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[120px] sm:max-w-none">
          {model.capabilities.slice(0, 2).map((capability) => (
            <Badge 
              key={capability} 
              className="bg-info/10 text-info border-info/20 text-xs"
            >
              {capability}
            </Badge>
          ))}
          {model.capabilities.length > 2 && (
            <Badge variant="outline" className="text-xs text-text-tertiary">
              +{model.capabilities.length - 2}
            </Badge>
          )}
        </div>
      )}
    </div>
  );

  // Only show view option since edit/delete aren't supported
  const dropdownItems = [
    {
      label: 'View Details',
      onClick: () => navigate(`/models/${model.id}`)
    }
  ];

  return (
    <CollectionItemRow
      icon={<Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />}
      title={model.name}
      description={model.description}
      statusBadge={getStatusBadge()}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => navigate(`/models/${model.id}`)}
      dropdownItems={dropdownItems}
    />
  );
};