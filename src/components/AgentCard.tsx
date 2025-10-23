import { Bot, CheckCircle2 } from 'lucide-react';
import type { AgentRecord } from '@/types/agent';

interface AgentCardProps {
  agent: AgentRecord;
  isActive: boolean;
  onClick: () => void;
}

export const AgentCard = ({ agent, isActive, onClick }: AgentCardProps) => {
  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-lg cursor-pointer transition-all duration-200 border
        ${isActive 
          ? 'bg-primary/10 border-primary shadow-sm' 
          : 'bg-card border-border hover:bg-accent hover:border-primary/50'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`
          p-2 rounded-lg transition-all
          ${isActive 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted text-muted-foreground'
          }
        `}>
          <Bot size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-sm truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
            {agent.name}
          </h3>
          <p className="text-xs text-muted-foreground truncate">{agent.model || 'AI Agent'}</p>
        </div>
        {isActive && (
          <CheckCircle2 size={16} className="text-primary flex-shrink-0" />
        )}
      </div>
    </div>
  );
};
