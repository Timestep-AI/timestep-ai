import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ChatRow } from '@/components/ChatRow';
import { CreateChatDialog } from '@/components/CreateChatDialog';
import { MessageSquare } from 'lucide-react';
import { Chat } from '@/types/chat';
import { chatsService } from '@/services/chatsService';

export const Chats = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);
        const fetchedChats = await chatsService.getAll();
        setChats(fetchedChats);
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, []);

  const handleChatCreated = () => {
    // Reload chats when a new one is created
    const loadChats = async () => {
      try {
        setLoading(true);
        const fetchedChats = await chatsService.getAll();
        setChats(fetchedChats);
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadChats();
  };

  const handleEdit = (chat: Chat) => {
    console.log('Edit chat:', chat);
  };

  const handleDelete = async (chat: Chat) => {
    try {
      await chatsService.delete(chat.id);
      const updatedChats = await chatsService.getAll();
      setChats(updatedChats);
    } catch (error) {
      console.error('Error deleting chat:', error);
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
      actionButton={<CreateChatDialog onChatCreated={handleChatCreated} />}
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