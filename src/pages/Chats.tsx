import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ChatRow } from '@/components/ChatRow';
import { CreateChatDialog } from '@/components/CreateChatDialog';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { Chat } from '@/types/chat';
import { chatsService } from '@/services/chatsService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const Chats = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = async (showToast = false) => {
    try {
      if (showToast) {
        setRefreshing(true);
        toast.info('Refreshing chats...');
      } else {
        setLoading(true);
      }
      
      console.log('Loading chats from backend...');
      const fetchedChats = await chatsService.getAll();
      console.log('Loaded chats:', fetchedChats);
      setChats(fetchedChats);
      
      if (showToast) {
        toast.success(`Loaded ${fetchedChats.length} chats`);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      if (showToast) {
        toast.error('Failed to refresh chats');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  const handleChatCreated = () => {
    // Reload chats when a new one is created
    loadChats(true);
  };

  const handleRefresh = () => {
    loadChats(true);
  };

  const handleEdit = (chat: Chat) => {
    console.log('Edit chat:', chat);
  };

  const handleDelete = async (chat: Chat) => {
    try {
      await chatsService.delete(chat.id);
      toast.success('Chat deleted successfully');
      const updatedChats = await chatsService.getAll();
      setChats(updatedChats);
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  };


  return (
    <CollectionPage
      title="Chats"
      items={chats}
      loading={loading}
      emptyIcon={<MessageSquare className="text-4xl text-text-tertiary" />}
      emptyTitle="No chats found"
      emptyDescription="Get started by creating your first chat."
      searchPlaceholder="Search chats..."
      actionButton={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <CreateChatDialog onChatCreated={handleChatCreated} />
        </div>
      }
      renderItem={(chat) => (
        <ChatRow
          chat={chat}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    />
  );
};

export default Chats;