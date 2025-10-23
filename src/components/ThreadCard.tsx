import { MessageSquare, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ThreadCardProps {
  thread?: {
    id: string;
    metadata?: { title?: string };
    created_at: string | number;
    items?: { data?: Array<{ content?: Array<{ text?: string }> }> };
  };
  isActive: boolean;
  isNewThread?: boolean;
  onClick: () => void;
}

export const ThreadCard = ({ thread, isActive, isNewThread, onClick }: ThreadCardProps) => {
  if (isNewThread) {
    return (
      <div
        onClick={onClick}
        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
          isActive
            ? 'bg-secondary/10 border-secondary shadow-[0_0_20px_rgba(200,0,255,0.5)]'
            : 'bg-background/50 border-secondary/20 hover:bg-secondary/5 hover:border-secondary/40 hover:shadow-[0_0_15px_rgba(200,0,255,0.3)]'
        }`}
      >
        <div className="flex items-center gap-3 text-secondary">
          <Plus size={18} style={{ filter: 'drop-shadow(0 0 5px rgba(200, 0, 255, 0.5))' }} />
          <span className="text-sm font-medium" style={{ textShadow: '0 0 10px rgba(200, 0, 255, 0.3)' }}>New Thread</span>
        </div>
      </div>
    );
  }

  if (!thread) return null;

  const timeAgo = thread.created_at 
    ? formatDistanceToNow(
        new Date(typeof thread.created_at === 'number' ? thread.created_at * 1000 : thread.created_at),
        { addSuffix: true }
      )
    : '';

  const preview = thread.items?.data?.[0]?.content?.[0]?.text || 'No messages yet';

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg cursor-pointer transition-all duration-300 border-2
        ${isActive 
          ? 'bg-secondary/10 border-secondary shadow-[0_0_20px_rgba(200,0,255,0.5)]' 
          : 'bg-background/50 border-secondary/20 hover:bg-secondary/5 hover:border-secondary/40 hover:shadow-[0_0_15px_rgba(200,0,255,0.3)]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 ${isActive ? 'text-secondary' : 'text-secondary/50'}`} style={{ filter: isActive ? 'drop-shadow(0 0 5px rgba(200, 0, 255, 0.5))' : 'none' }}>
          <MessageSquare size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 
            className="text-sm font-medium text-secondary truncate" 
            style={{ textShadow: isActive ? '0 0 10px rgba(200, 0, 255, 0.5)' : 'none' }}
          >
            {thread.metadata?.title || `Thread ${thread.id.slice(0, 8)}`}
          </h4>
          <p className="text-xs text-secondary/50 truncate mt-1 font-mono">{preview}</p>
          <p className="text-xs text-secondary/30 mt-2 font-mono">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
};
