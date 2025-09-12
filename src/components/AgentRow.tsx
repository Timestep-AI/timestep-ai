import { User, Calendar, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CollectionItemRow } from '@/components/CollectionItemRow';

interface Agent {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  model?: string;
  status: 'active' | 'inactive';
  isHandoff: boolean;
}

interface AgentRowProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
}

export const AgentRow = ({ agent, onEdit, onDelete }: AgentRowProps) => {
  const navigate = useNavigate();

  const statusBadge = agent.isHandoff ? (
    <Badge variant="secondary" className="text-xs flex-shrink-0">
      Handoff
    </Badge>
  ) : null;

  const metadata = [
    {
      icon: <Calendar className="w-3 h-3 flex-shrink-0" />,
      text: `Created: ${agent.createdAt}`
    }
  ];

  const rightContent = agent.model ? (
    <Badge 
      className="bg-info/10 text-info border-info/20 text-xs cursor-pointer hover:bg-info/20 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        // Navigate to model page - we'll use the model name as ID for now
        navigate(`/models/ollama-gpt-oss-20b`);
      }}
    >
      <Cpu className="w-3 h-3 mr-1" />
      <span className="truncate max-w-[120px] sm:max-w-none">{agent.model}</span>
    </Badge>
  ) : (
    <Badge variant="outline" className="text-text-tertiary text-xs">
      No Model
    </Badge>
  );

  const dropdownItems = [
    {
      label: 'Edit Agent',
      onClick: () => onEdit?.(agent)
    },
    {
      label: 'Delete Agent',
      onClick: () => onDelete?.(agent),
      destructive: true
    }
  ];

  return (
    <CollectionItemRow
      icon={<User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />}
      title={agent.name}
      description={agent.description}
      statusBadge={statusBadge}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => navigate(`/agents/${agent.id}`)}
      dropdownItems={dropdownItems}
    />
  );
};