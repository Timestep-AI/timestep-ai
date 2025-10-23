import { Bot, Zap } from 'lucide-react';
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
        relative p-4 rounded-xl cursor-pointer transition-all duration-300
        ${isActive 
          ? 'bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary shadow-lg shadow-primary/20' 
          : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`
          p-2 rounded-lg transition-all
          ${isActive ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-white/70'}
        `}>
          <Bot size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-white truncate">{agent.name}</h3>
          <p className="text-xs text-white/50 truncate">{agent.model || 'AI Agent'}</p>
        </div>
        {isActive && (
          <div className="absolute top-2 right-2">
            <Zap size={14} className="text-primary animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};
