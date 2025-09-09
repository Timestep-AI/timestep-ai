import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Calendar, Users, Hash } from 'lucide-react';
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

  const getStatusBadge = () => {
    switch (chat?.status) {
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
    <ItemPage
      loading={loading}
      item={chat}
      itemType="Chat"
      backPath="/chats"
      backLabel="Back to Chats"
      icon={<MessageCircle className="w-8 h-8 text-primary-foreground" />}
      onEdit={handleEdit}
      onDelete={handleDelete}
      statusBadge={getStatusBadge()}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

      {/* Messages */}
      <div className="border-t border-border pt-6">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Messages</h2>
        
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
    </ItemPage>
  );
};

export default Chat;