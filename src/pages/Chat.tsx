import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Calendar, Users, Hash, Send, Bot } from 'lucide-react';
import { Chat as ChatType } from '@/types/chat';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';
import { Task, TaskStatusUpdateEvent } from '@/types/a2a';
import { chatsService } from '@/services/chatsService';
import { messagesService } from '@/services/messagesService';
import { agentsService } from '@/services/agentsService';
import { MessageRow } from '@/components/MessageRow';
import { a2aClient } from '@/services/a2aClient';
import { toast } from 'sonner';

export const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chat, setChat] = useState<ChatType | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

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

        // Load agent information
        if (foundChat?.agentId) {
          const agentInfo = await agentsService.getById(foundChat.agentId);
          setAgent(agentInfo);
        }
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id || sending) return;

    try {
      setSending(true);
      
      // Create user message first
      const userMessage = await messagesService.create({
        chatId: id,
        content: newMessage,
        sender: 'User',
        type: 'user',
        status: 'sent'
      });

      // Update messages list immediately
      const updatedMessages = await messagesService.getByChatId(id);
      setMessages(updatedMessages);
      
      // Clear input
      setNewMessage('');

      // Send to A2A agent
      const a2aMessage = a2aClient.convertToA2AMessage(userMessage);
      a2aMessage.contextId = id; // Use the chat ID as context ID
      const messageParams = { message: a2aMessage };

      toast.info(`Sending message to ${agent?.name || 'agent'}...`);

      // Use agent-specific client if available
      const clientForAgent = agent ? a2aClient.createClientForAgent(agent) : a2aClient;

      // Process A2A response stream
      const stream = clientForAgent.sendMessageStream(messageParams);
      
      let currentAgentMessage = '';
      let hasReceivedAgentMessage = false;
      
      for await (const event of stream) {
        console.log('A2A Event:', event);
        
        // Handle different A2A event types
        if (event.kind === 'message' && 'role' in event && event.role === 'agent') {
          // Handle agent message responses
          const agentMessage = a2aClient.convertFromA2AMessage(event, id);
          await messagesService.create({
            chatId: id,
            content: agentMessage.content!,
            sender: agentMessage.sender!,
            type: agentMessage.type!,
            status: agentMessage.status!
          });

          // Refresh messages list
          const refreshedMessages = await messagesService.getByChatId(id);
          setMessages(refreshedMessages);
          hasReceivedAgentMessage = true;
        } else if (event.kind === 'status-update') {
          // Handle status updates
          const statusEvent = event as TaskStatusUpdateEvent;
          console.log(`Task ${statusEvent.taskId} status: ${statusEvent.status.state}`);
          
          if (statusEvent.status.state === 'completed' && statusEvent.final) {
            console.log('Task completed');
          }
        } else if (event.kind === 'task') {
          // Handle task creation
          const task = event as Task;
          console.log(`Task created: ${task.id}`);
        }
      }

      if (hasReceivedAgentMessage) {
        toast.success('Message sent successfully!');
      } else {
        toast.warning('No response received from agent');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
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
      {chat && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Created: {chat.createdAt}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Hash className="w-4 h-4 flex-shrink-0" />
              <span>{messages.length} messages</span>
            </div>

            {agent && (
              <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                <Bot className="w-4 h-4 flex-shrink-0" />
                <span>Agent: {agent.name}</span>
              </div>
            )}
            
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

            {/* Message Input */}
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                  className="flex-1 resize-none min-h-[80px]"
                  disabled={sending}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default Chat;