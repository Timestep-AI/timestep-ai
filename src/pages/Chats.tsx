import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { ChatRow } from '@/components/ChatRow';
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

  const handleEdit = (chat: Chat) => {
    // TODO: Implement edit functionality
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

  const handleCreateDefaults = async () => {
    try {
      await chatsService.createDefaults();
      const updatedChats = await chatsService.getAll();
      setChats(updatedChats);
    } catch (error) {
      console.error('Error creating default chats:', error);
    }
  };

  return (
    <CollectionPage
      title="Chats"
      items={chats}
      loading={loading}
      emptyIcon={<MessageSquare className="text-4xl text-text-tertiary" />}
      emptyTitle="No chats found"
      emptyDescription="Get started by creating some default chats."
      searchPlaceholder="Search chats..."
      itemCountLabel={(count) => `${count} chat${count !== 1 ? 's' : ''}`}
      onCreateDefaults={handleCreateDefaults}
      renderItem={(chat) => (
        <ChatRow
          key={chat.id}
          chat={chat}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      showSearch={true}
      showDeleteAll={false}
      showCreateButton={false}
    />
  );
};

export default Chats;