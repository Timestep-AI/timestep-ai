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
        relative p-4 rounded-lg cursor-pointer transition-all duration-300 border-2
        ${isActive 
          ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(0,255,255,0.5)]' 
          : 'bg-background/50 border-primary/20 hover:bg-primary/5 hover:border-primary/40 hover:shadow-[0_0_15px_rgba(0,255,255,0.3)]'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`
          p-2 rounded-lg transition-all border-2
          ${isActive 
            ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_rgba(0,255,255,0.6)]' 
            : 'bg-background border-primary/30 text-primary/70'
          }
        `}>
          <Bot size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 
            className="font-medium text-sm text-primary truncate" 
            style={{ textShadow: isActive ? '0 0 10px rgba(0, 255, 255, 0.5)' : 'none' }}
          >
            {agent.name}
          </h3>
          <p className="text-xs text-primary/50 truncate font-mono">{agent.model || 'AI Agent'}</p>
        </div>
        {isActive && (
          <div className="absolute top-2 right-2">
            <Zap size={14} className="text-primary animate-pulse" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.8))' }} />
          </div>
        )}
      </div>
    </div>
  );
};
