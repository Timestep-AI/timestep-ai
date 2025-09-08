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
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 hover:bg-surface-elevated transition-all duration-200 group overflow-hidden">
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0 overflow-hidden">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
          
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-start space-x-2 mb-1">
              <h3 className="font-semibold text-text-primary text-sm sm:text-base truncate">
                {agent.name}
              </h3>
              {agent.status === 'handoff' && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  Handoff
                </Badge>
              )}
            </div>
            
            {agent.description && (
              <p className="text-xs sm:text-sm text-text-secondary mb-2 line-clamp-2">
                {agent.description}
              </p>
            )}
            
            <div className="flex items-center flex-wrap gap-1 sm:gap-2 text-xs text-text-tertiary">
              <div className="flex items-center space-x-1 min-w-0">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Created: {agent.createdAt}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 flex-shrink-0 ml-2">
          {agent.model ? (
            <Badge className="bg-info/10 text-info border-info/20 text-xs max-w-[100px]">
              <Cpu className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">{agent.model}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-text-tertiary text-xs">
              No Model
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 flex-shrink-0"
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