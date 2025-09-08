import { MoreHorizontal, MessageCircle, Calendar, Users, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Chat {
  id: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status: 'active' | 'archived' | 'paused';
  participants?: string[];
}

interface ChatRowProps {
  chat: Chat;
  onEdit?: (chat: Chat) => void;
  onDelete?: (chat: Chat) => void;
}

export const ChatRow = ({ chat, onEdit, onDelete }: ChatRowProps) => {
  const navigate = useNavigate();

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown menu
    if ((e.target as HTMLElement).closest('[data-dropdown-trigger]')) {
      return;
    }
    navigate(`/chats/${chat.id}`);
  };

  const getStatusBadge = () => {
    switch (chat.status) {
      case 'archived':
        return <Badge variant="secondary" className="text-xs flex-shrink-0">Archived</Badge>;
      case 'paused':
        return <Badge variant="outline" className="text-xs flex-shrink-0">Paused</Badge>;
      default:
        return null;
    }
  };

  return (
    <div 
      className="bg-card border border-border rounded-xl p-3 sm:p-4 hover:bg-surface-elevated transition-all duration-200 group cursor-pointer"
      onClick={handleRowClick}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0 mb-3 sm:mb-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start space-x-2 mb-1">
              <h3 className="font-semibold text-text-primary text-sm sm:text-base break-words">
                {chat.title}
              </h3>
              {getStatusBadge()}
            </div>
            
            {chat.lastMessage && (
              <p className="text-xs sm:text-sm text-text-secondary mb-2 break-words line-clamp-2">
                {chat.lastMessage}
              </p>
            )}
            
            <div className="flex items-center flex-wrap gap-1 sm:gap-3 text-xs text-text-tertiary">
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span className="break-all">Updated: {chat.updatedAt}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Hash className="w-3 h-3 flex-shrink-0" />
                <span>{chat.messageCount} messages</span>
              </div>
              {chat.participants && chat.participants.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Users className="w-3 h-3 flex-shrink-0" />
                  <span>{chat.participants.length} participants</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-2 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                data-dropdown-trigger
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(chat)}>
                Edit Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(chat)} className="text-destructive">
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};