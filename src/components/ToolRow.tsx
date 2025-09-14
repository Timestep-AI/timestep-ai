import { Tool } from '@/types/tool';
import { CollectionItemRow } from '@/components/CollectionItemRow';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  Calendar, 
  Activity,
  Shield,
  Tag
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
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'maintenance':
        return <Badge variant="outline">Maintenance</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryColor = (category: Tool['category']) => {
    switch (category) {
      case 'development':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'productivity':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'communication':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'analysis':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'automation':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const metadata = [
    {
      icon: <Calendar className="w-3 h-3" />,
      text: `Updated ${formatDate(tool.updatedAt)}`
    },
    {
      icon: <Activity className="w-3 h-3" />,
      text: `${tool.usage.monthly} uses this month`
    },
    {
      icon: <Shield className="w-3 h-3" />,
      text: `${tool.permissions.length} permissions`
    }
  ];

  const rightContent = (
    <div className="flex flex-col items-end space-y-1">
      <div className="flex items-center space-x-1">
        <Tag className="w-3 h-3 text-text-tertiary" />
        <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(tool.category)}`}>
          {tool.category}
        </span>
      </div>
      <span className="text-xs text-text-tertiary">v{tool.version}</span>
      <span className="text-xs text-text-secondary font-medium">{tool.mcpServer}</span>
    </div>
  );

  const dropdownItems = [
    {
      label: 'Edit',
      onClick: () => onEdit?.(tool)
    },
    {
      label: 'Delete',
      onClick: () => onDelete?.(tool.id),
      destructive: true
    }
  ];

  return (
    <CollectionItemRow
      icon={<Wrench className="w-5 h-5 text-white" />}
      title={tool.name}
      description={tool.description}
      statusBadge={getStatusBadge(tool.status)}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => navigate(`/tools/${tool.id}`)}
      dropdownItems={dropdownItems}
    />
  );
};