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

  const metadata = [
    {
      icon: <Calendar className="w-3 h-3 flex-shrink-0" />,
      text: `Created: ${new Date(model.created * 1000).toLocaleDateString()}`
    }
  ];

  const rightContent = (
    <div className="flex flex-col items-end space-y-1">
      <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs flex items-center gap-1">
        <Cpu className="w-3 h-3" />
        {model.owned_by}
      </Badge>
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
      icon={<Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
      title={model.id}
      description={`${model.object} from ${model.owned_by}`}
      statusBadge={null}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => navigate(`/models/${model.id.replace('/', '-')}`)}
      dropdownItems={dropdownItems}
    />
  );
};