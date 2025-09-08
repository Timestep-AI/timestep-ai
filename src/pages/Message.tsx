import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageSquare, Calendar, User, Bot, Settings, Edit, Trash2, Paperclip } from 'lucide-react';
import { Message as MessageType } from '@/types/message';
import { messagesService } from '@/services/messagesService';

export const Message = () => {
  const { id: chatId, messageId } = useParams<{ id: string; messageId: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState<MessageType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMessage = async () => {
      if (!messageId) return;
      
      try {
        setLoading(true);
        const foundMessage = await messagesService.getById(messageId);
        setMessage(foundMessage);
      } catch (error) {
        console.error('Error loading message:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessage();
  }, [messageId]);

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit message:', message);
  };

  const handleDelete = async () => {
    if (!message) return;
    
    try {
      await messagesService.delete(message.id);
      navigate(`/chats/${chatId}`);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-text-secondary">Loading message...</div>
        </div>
      </Layout>
    );
  }

  if (!message) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-text-secondary mb-4">Message not found</div>
          <Button onClick={() => navigate(`/chats/${chatId}`)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
        </div>
      </Layout>
    );
  }

  const getTypeIcon = () => {
    switch (message.type) {
      case 'user':
        return <User className="w-8 h-8 text-primary-foreground" />;
      case 'assistant':
        return <Bot className="w-8 h-8 text-primary-foreground" />;
      case 'system':
        return <Settings className="w-8 h-8 text-primary-foreground" />;
      default:
        return <MessageSquare className="w-8 h-8 text-primary-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (message.status) {
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'sent':
        return <Badge variant="secondary">Sent</Badge>;
      case 'delivered':
        return <Badge variant="outline">Delivered</Badge>;
      case 'read':
        return <Badge className="bg-success/10 text-success border-success/20">Read</Badge>;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(`/chats/${chatId}`)}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button onClick={handleEdit} variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button onClick={handleDelete} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Message Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
              {getTypeIcon()}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-2xl font-bold text-text-primary">
                  {message.sender}
                </h1>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="capitalize">
                    {message.type}
                  </Badge>
                  {getStatusBadge()}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-text-tertiary mb-4">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{message.timestamp}</span>
              </div>
            </div>
          </div>
          
          {/* Message Content */}
          <div className="border-t border-border pt-6 mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Message Content</h3>
            <div className="bg-surface-elevated p-4 rounded-lg">
              <p className="text-text-primary whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
          </div>
          
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="border-t border-border pt-6 mb-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                <Paperclip className="w-5 h-5 mr-2" />
                Attachments ({message.attachments.length})
              </h3>
              <div className="space-y-2">
                {message.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center p-3 bg-surface-elevated rounded-lg">
                    <Paperclip className="w-4 h-4 mr-2 text-text-tertiary" />
                    <span className="text-text-primary break-all">{attachment}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Additional Details */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">Message ID</label>
                <p className="text-text-primary font-mono text-sm break-all">{message.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Chat ID</label>
                <p className="text-text-primary font-mono text-sm break-all">{message.chatId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Type</label>
                <p className="text-text-primary capitalize">{message.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Status</label>
                <p className="text-text-primary capitalize">{message.status}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Message;