import { User, Calendar, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

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

  return (
    <div 
      className="border border-border rounded-xl p-4 hover:border-muted-foreground/60 transition-all duration-200 cursor-pointer bg-card"
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          {agent.isHandoff ? (
            <ArrowRightLeft className="w-5 h-5 text-white" />
          ) : (
            <User className="w-5 h-5 text-white" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-foreground text-base">
                {agent.name}
              </h3>
              {statusBadge}
            </div>
            {agent.model && agent.model.trim() ? (
              <Badge 
                className="bg-primary/10 text-primary border-primary/20 text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const modelId = agent.model?.replace('/', '-') || '';
                  navigate(`/models/${modelId}`);
                }}
              >
                {agent.model}
              </Badge>
            ) : null}
          </div>
          
          {agent.description && (
            <p className="text-sm text-muted-foreground mb-3">
              {agent.description}
            </p>
          )}
          
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>Created: {agent.createdAt}</span>
          </div>
        </div>
      </div>
    </div>
  );
};