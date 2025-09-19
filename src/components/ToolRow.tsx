import { Tool } from '@/types/tool';
import { CollectionItemRow } from '@/components/CollectionItemRow';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  Server
} from 'lucide-react';

interface ToolRowProps {
  tool: Tool;
  onEdit?: (tool: Tool) => void;
  onDelete?: (toolId: string) => void;
}

export const ToolRow = ({ tool, onEdit, onDelete }: ToolRowProps) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: Tool['status']) => {
    switch (status) {
      case 'available':
        return <Badge variant="default">Available</Badge>;
      case 'unavailable':
        return <Badge variant="secondary">Unavailable</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const rightContent = (
    <div className="flex flex-col items-end space-y-1">
      <Badge 
        className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs flex items-center gap-1"
      >
        <Server className="w-3 h-3" />
        {tool.serverName}
      </Badge>
      <span className="text-xs text-text-tertiary px-2 py-1 bg-background-secondary rounded-full">
        {tool.category}
      </span>
    </div>
  );

  // Only show view option since edit/delete aren't supported
  const dropdownItems = [
    {
      label: 'View Details',
      onClick: () => navigate(`/tools/${tool.id}`)
    }
  ];

  return (
    <CollectionItemRow
      icon={<Wrench className="w-5 h-5 text-white" />}
      title={tool.name}
      description={tool.description}
      statusBadge={getStatusBadge(tool.status)}
      metadata={[]}
      rightContent={rightContent}
      onItemClick={() => navigate(`/tools/${tool.id}`)}
      dropdownItems={dropdownItems}
    />
  );
};