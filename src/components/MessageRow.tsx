import { MoreHorizontal, MessageSquare, Calendar, User, Bot, Settings, Wrench, Code } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Message } from '@/types/message';

interface MessageRowProps {
  message: Message;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}

export const MessageRow = ({ message, onEdit, onDelete }: MessageRowProps) => {
  const navigate = useNavigate();
  const { id: chatId } = useParams<{ id: string }>();

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown menu
    if ((e.target as HTMLElement).closest('[data-dropdown-trigger]')) {
      return;
    }
    navigate(`/chats/${chatId}/messages/${message.id}`);
  };

  const getTypeIcon = () => {
    switch (message.type) {
      case 'user':
        return <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      case 'assistant':
        return <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      case 'system':
        return <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      case 'tool_call':
        return <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      case 'tool_response':
        return <Code className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      default:
        return <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
    }
  };

  const getStatusBadge = () => {
    switch (message.status) {
      case 'failed':
        return <Badge variant="destructive" className="text-xs flex-shrink-0">Failed</Badge>;
      case 'sent':
        return <Badge variant="secondary" className="text-xs flex-shrink-0">Sent</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="text-xs flex-shrink-0">Delivered</Badge>;
      case 'read':
        return <Badge className="bg-success/10 text-success border-success/20 text-xs flex-shrink-0">Read</Badge>;
      default:
        return null;
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const renderContent = () => {
    if (message.type === 'tool_call' && message.toolCalls && message.toolCalls.length > 0) {
      const toolCall = message.toolCalls[0];
      return (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm text-text-secondary">
            {message.content}
          </p>
          <div className="bg-surface-elevated rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-primary">Tool Call: {toolCall.function.name}</span>
              {message.approved ? (
                <Badge className="bg-success/10 text-success border-success/20 text-xs">Approved</Badge>
              ) : (
                <div className="flex space-x-1">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs">Reject</Button>
                  <Button size="sm" className="h-6 px-2 text-xs">Approve</Button>
                </div>
              )}
            </div>
            <pre className="text-xs text-text-tertiary whitespace-pre-wrap break-words font-mono">
              {JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2)}
            </pre>
          </div>
        </div>
      );
    }
    
    if (message.type === 'tool_response') {
      let formattedResponse;
      try {
        const parsed = JSON.parse(message.content);
        formattedResponse = JSON.stringify(parsed, null, 2);
      } catch {
        formattedResponse = message.content;
      }
      
      return (
        <div className="bg-surface-elevated rounded-lg p-3 border border-border">
          <div className="flex items-center mb-2">
            <span className="text-xs font-medium text-text-primary">Response</span>
            {message.toolCallId && (
              <span className="text-xs text-text-tertiary ml-2">({message.toolCallId})</span>
            )}
          </div>
          <pre className="text-xs text-text-tertiary whitespace-pre-wrap break-words font-mono">
            {formattedResponse}
          </pre>
        </div>
      );
    }
    
    return (
      <p className="text-xs sm:text-sm text-text-secondary mb-2 break-words line-clamp-2">
        {truncateContent(message.content)}
      </p>
    );
  };

  return (
    <div 
      className="bg-card border border-muted-foreground/80 rounded-xl p-3 sm:p-4 hover:border-muted-foreground transition-all duration-200 group cursor-pointer"
      onClick={handleRowClick}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0 mb-3 sm:mb-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
            {getTypeIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start space-x-2 mb-1">
              <h3 className="font-semibold text-text-primary text-sm sm:text-base break-words">
                {message.sender}
              </h3>
              <Badge variant="outline" className="text-xs flex-shrink-0 capitalize">
                {message.type === 'tool_call' ? 'assistant' : message.type === 'tool_response' ? 'tool' : message.type.replace('_', ' ')}
              </Badge>
              {getStatusBadge()}
            </div>
            
            {renderContent()}
            
            <div className="flex items-center flex-wrap gap-1 sm:gap-3 text-xs text-text-tertiary">
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span className="break-all">{message.timestamp}</span>
              </div>
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex items-center space-x-1">
                  <span>{message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}</span>
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
              <DropdownMenuItem onClick={() => onEdit?.(message)}>
                Edit Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(message)} className="text-destructive">
                Delete Message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};