import { MCPServer } from '@/types/mcpServer';
import { CollectionItemRow } from '@/components/CollectionItemRow';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  Server, 
  Calendar, 
  Activity,
  Wrench,
  Zap
} from 'lucide-react';

interface MCPServerRowProps {
  server: MCPServer;
  onDelete?: (serverId: string) => void;
}

export const MCPServerRow = ({ server, onDelete }: MCPServerRowProps) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: MCPServer['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const metadata = [
    {
      icon: <Calendar className="w-3 h-3" />,
      text: `Connected ${formatDate(server.lastConnected)}`
    },
    {
      icon: <Wrench className="w-3 h-3" />,
      text: `${server.toolCount} tool${server.toolCount !== 1 ? 's' : ''}`
    },
    {
      icon: <Zap className="w-3 h-3" />,
      text: `v${server.version}`
    }
  ];

  const rightContent = (
    <div className="flex flex-col items-end space-y-1">
      <div className="flex items-center space-x-1">
        <Activity className="w-3 h-3 text-text-tertiary" />
        <span className="text-xs text-text-tertiary">
          {server.status === 'active' ? 'Online' : 'Offline'}
        </span>
      </div>
      <span className="text-xs text-text-secondary">ID: {server.id.slice(0, 8)}...</span>
    </div>
  );

  const dropdownItems = [
    {
      label: 'View Details',
      onClick: () => navigate(`/settings/mcp_servers/${server.id}`)
    }
  ];

  if (onDelete) {
    dropdownItems.push({
      label: 'Delete',
      onClick: () => onDelete(server.id),
      destructive: true
    } as any);
  }

  return (
    <CollectionItemRow
      icon={<Server className="w-5 h-5 text-white" />}
      title={server.name}
      description={server.description}
      statusBadge={getStatusBadge(server.status)}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => navigate(`/settings/mcp_servers/${server.id}`)}
      dropdownItems={dropdownItems}
    />
  );
};