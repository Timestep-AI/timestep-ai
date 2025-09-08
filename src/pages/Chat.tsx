import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageCircle, Calendar, Users, Hash, Edit, Trash2 } from 'lucide-react';
import { Chat as ChatType } from '@/types/chat';
import { Message } from '@/types/message';
import { chatsService } from '@/services/chatsService';
import { messagesService } from '@/services/messagesService';
import { MessageRow } from '@/components/MessageRow';

export const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chat, setChat] = useState<ChatType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChatAndMessages = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [chats, chatMessages] = await Promise.all([
          chatsService.getAll(),
          messagesService.getByChatId(id)
        ]);
        
        const foundChat = chats.find(c => c.id === id);
        setChat(foundChat || null);
        setMessages(chatMessages);
      } catch (error) {
        console.error('Error loading chat and messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChatAndMessages();
  }, [id]);

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit chat:', chat);
  };

  const handleDelete = async () => {
    if (!chat) return;
    
    try {
      await chatsService.delete(chat.id);
      navigate('/chats');
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleEditMessage = (message: Message) => {
    // TODO: Implement edit message functionality
    console.log('Edit message:', message);
  };

  const handleDeleteMessage = async (message: Message) => {
    try {
      await messagesService.delete(message.id);
      const updatedMessages = await messagesService.getByChatId(id!);
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-text-secondary">Loading chat...</div>
        </div>
      </Layout>
    );
  }

  if (!chat) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-text-secondary mb-4">Chat not found</div>
          <Button onClick={() => navigate('/chats')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chats
          </Button>
        </div>
      </Layout>
    );
  }

  const getStatusBadge = () => {
    switch (chat.status) {
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
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
            onClick={() => navigate('/chats')}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chats
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

        {/* Chat Overview */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-2xl font-bold text-text-primary">
                  {chat.title}
                </h1>
                {getStatusBadge()}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>Created: {chat.createdAt}</span>
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span>{messages.length} messages</span>
                </div>
                
                {chat.participants && chat.participants.length > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>{chat.participants.length} participants</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Messages</h2>
          
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="text-4xl text-text-tertiary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No messages found
              </h3>
              <p className="text-text-secondary">
                This chat doesn't have any messages yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Chat;