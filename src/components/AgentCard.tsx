import { MoreHorizontal, User, Calendar, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Agent {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  model?: string;
  status: 'active' | 'inactive' | 'handoff';
}

interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
}

export const AgentCard = ({ agent, onEdit, onDelete }: AgentCardProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:bg-surface-elevated transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-text-primary truncate">
                {agent.name}
              </h3>
              {agent.status === 'handoff' && (
                <Badge variant="secondary" className="text-xs">
                  Handoff
                </Badge>
              )}
            </div>
            
            {agent.description && (
              <p className="text-sm text-text-secondary mb-2 line-clamp-2">
                {agent.description}
              </p>
            )}
            
            <div className="flex items-center space-x-4 text-xs text-text-tertiary">
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>Created: {agent.createdAt}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {agent.model ? (
            <Badge className="bg-info/10 text-info border-info/20">
              <Cpu className="w-3 h-3 mr-1" />
              {agent.model}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-text-tertiary">
              No Model
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(agent)}>
                Edit Agent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(agent)} className="text-destructive">
                Delete Agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};