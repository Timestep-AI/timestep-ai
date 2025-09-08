import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { ChatRow } from '@/components/ChatRow';
import { CreateDefaultsButton } from '@/components/CreateDefaultsButton';
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-text-secondary">Loading chats...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text-primary">Chats</h2>
          <CreateDefaultsButton 
            onClick={handleCreateDefaults}
          />
        </div>
        
        {chats.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="text-4xl text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No chats found
            </h3>
            <p className="text-text-secondary mb-4">
              Get started by creating some default chats.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Chats;