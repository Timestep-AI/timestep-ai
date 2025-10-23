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
        className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
          isActive
            ? 'bg-primary/10 border-primary shadow-sm'
            : 'bg-card border-border hover:bg-accent hover:border-primary/50'
        }`}
      >
        <div className={`flex items-center gap-3 ${isActive ? 'text-primary' : 'text-foreground'}`}>
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
        p-4 rounded-lg cursor-pointer transition-all duration-200 border
        ${isActive 
          ? 'bg-primary/10 border-primary shadow-sm' 
          : 'bg-card border-border hover:bg-accent hover:border-primary/50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
          <MessageSquare size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
            {thread.metadata?.title || `Thread ${thread.id.slice(0, 8)}`}
          </h4>
          <p className="text-xs text-muted-foreground truncate mt-1">{preview}</p>
          <p className="text-xs text-muted-foreground/70 mt-1.5">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
};
