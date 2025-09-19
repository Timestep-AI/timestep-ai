import { MCPServer } from '@/types/mcpServer';
import { CollectionItemRow } from '@/components/CollectionItemRow';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  Server, 
  Activity
} from 'lucide-react';

interface MCPServerRowProps {
  server: MCPServer;
  onEdit?: (server: MCPServer) => void;
  onDelete?: (serverId: string) => void;
}

export const MCPServerRow = ({ server, onEdit, onDelete }: MCPServerRowProps) => {
  const navigate = useNavigate();

  const getStatusBadge = (enabled: boolean) => {
    return enabled 
      ? <Badge variant="default">Enabled</Badge>
      : <Badge variant="secondary">Disabled</Badge>;
  };

  // Only show metadata that actually exists in the API response
  const metadata = [
    {
      icon: <Server className="w-3 h-3" />,
      text: server.serverUrl ? new URL(server.serverUrl).hostname : 'No URL'
    }
  ].filter(item => item.text !== 'No URL'); // Only show if we have a URL

  const rightContent = (
    <div className="flex flex-col items-end space-y-1">
      <div className="flex items-center space-x-1">
        <Activity className="w-3 h-3 text-text-tertiary" />
        <span className="text-xs text-text-tertiary">
          {server.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <span className="text-xs text-text-secondary">ID: {server.id.slice(0, 8)}...</span>
    </div>
  );

  const dropdownItems = [
    {
      label: 'View Details',
      onClick: () => navigate(`/admin/tool_providers/${server.id}`)
    },
    ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(server) }] : [])
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
      statusBadge={getStatusBadge(server.enabled)}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => navigate(`/admin/tool_providers/${server.id}`)}
      dropdownItems={dropdownItems}
    />
  );
};