import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Calendar, Users, Hash, Send, Bot, RefreshCw } from 'lucide-react';
import { Chat as ChatType } from '@/types/chat';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';
import { chatsService } from '@/services/chatsService';
import { agentsService } from '@/services/agentsService';
import { supabase } from '@/integrations/supabase/client';
import { MessageRow } from '@/components/MessageRow';
import { toast } from 'sonner';

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chat, setChat] = useState<ChatType | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id) {
      loadChat();
    }
  }, [id]);

  const loadChat = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const chatData = await chatsService.getById(id);
      
      if (chatData) {
        setChat(chatData);
        
        // Load agent if available
        if (chatData.agentId) {
          try {
            const agentData = await agentsService.getById(chatData.agentId);
            setAgent(agentData);
          } catch (error) {
            console.error('Error loading agent:', error);
          }
        }
      } else {
          toast.error('Chat not found');
        navigate('/chats');
          return;
        }

      setMessages([]); // Start with empty messages since we removed messagesService
      } catch (error) {
      console.error('Error loading chat:', error);
        toast.error('Failed to load chat');
      } finally {
        setLoading(false);
    }
  };

  const handleRefresh = async () => {
      setRefreshing(true);
    await loadChat();
      setRefreshing(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Create user message
      const userMessage: Partial<Message> = {
        chatId: id,
        type: 'user',
        content: messageText,
        timestamp: new Date().toISOString()
      };

      // Create user message locally (no persistence since we removed messagesService)
      const userMessageObj: Message = {
        id: `msg-${Date.now()}-user`,
        chatId: id,
        type: 'user',
        content: messageText,
        sender: 'User',
        status: 'sent',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessageObj]);

      // TODO: Integrate with real agent system
      throw new Error('Chat functionality not implemented - requires real agent integration');

      // Create response message locally (no persistence since we removed messagesService)
      const responseMessageObj: Message = {
        id: `msg-${Date.now()}-assistant`,
        chatId: id,
        type: 'assistant',
        content: responseMessage.content || '',
        sender: 'Assistant',
        status: 'sent',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, responseMessageObj]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <ItemPage
        title="Loading..."
        subtitle="Loading chat..."
        icon={MessageCircle}
      />
    );
  }

  if (!chat) {
    return (
      <ItemPage
        title="Chat Not Found"
        subtitle="The requested chat could not be found"
        icon={MessageCircle}
      />
    );
  }

  return (
    <ItemPage
      title={chat.title || 'Chat'}
      subtitle={
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(chat.createdAt).toLocaleDateString()}
            </div>
            {agent && (
            <div className="flex items-center gap-1">
              <Bot className="w-4 h-4" />
              {agent.name}
              </div>
            )}
          <div className="flex items-center gap-1">
            <Hash className="w-4 h-4" />
            {id}
          </div>
        </div>
      }
      icon={MessageCircle}
      actions={
        <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
            {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start a conversation!
              </div>
            ) : (
            messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))
                      )}
                    </div>

            {/* Message Input */}
        <div className="border-t p-4">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 min-h-[60px] resize-none"
                  disabled={sending}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
              size="lg"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
    </ItemPage>
  );
};

export default Chat;