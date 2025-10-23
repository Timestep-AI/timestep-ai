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
        className="p-4 rounded-lg border-2 border-dashed border-white/20 hover:border-primary/50 cursor-pointer transition-all duration-300 hover:bg-white/5"
      >
        <div className="flex items-center gap-3 text-white/70">
          <Plus size={18} />
          <span className="text-sm font-medium">New Thread</span>
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
        p-4 rounded-lg cursor-pointer transition-all duration-300
        ${isActive 
          ? 'bg-primary/10 border border-primary shadow-md shadow-primary/10' 
          : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 ${isActive ? 'text-primary' : 'text-white/50'}`}>
          <MessageSquare size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">
            {thread.metadata?.title || `Thread ${thread.id.slice(0, 8)}`}
          </h4>
          <p className="text-xs text-white/50 truncate mt-1">{preview}</p>
          <p className="text-xs text-white/30 mt-2">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
};
