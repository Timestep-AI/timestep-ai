import { MessageCircle, Calendar, Users, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CollectionItemRow } from '@/components/CollectionItemRow';

interface Chat {
  id: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status: 'active' | 'archived' | 'paused';
  participants?: string[];
}

interface ChatRowProps {
  chat: Chat;
  onEdit?: (chat: Chat) => void;
  onDelete?: (chat: Chat) => void;
}

export const ChatRow = ({ chat, onEdit, onDelete }: ChatRowProps) => {
  const navigate = useNavigate();

  const getStatusBadge = () => {
    switch (chat.status) {
      case 'archived':
        return <Badge variant="secondary" className="text-xs flex-shrink-0">Archived</Badge>;
      case 'paused':
        return <Badge variant="outline" className="text-xs flex-shrink-0">Paused</Badge>;
      default:
        return null;
    }
  };

  const metadata = [
    {
      icon: <Calendar className="w-3 h-3 flex-shrink-0" />,
      text: `Updated: ${chat.updatedAt}`
    },
    {
      icon: <Hash className="w-3 h-3 flex-shrink-0" />,
      text: `${chat.messageCount} messages`
    },
    ...(chat.participants && chat.participants.length > 0 ? [{
      icon: <Users className="w-3 h-3 flex-shrink-0" />,
      text: `${chat.participants.length} participants`
    }] : [])
  ];

  const dropdownItems = [
    {
      label: 'Edit Chat',
      onClick: () => onEdit?.(chat)
    },
    {
      label: 'Delete Chat',
      onClick: () => onDelete?.(chat),
      destructive: true
    }
  ];

  return (
    <CollectionItemRow
      icon={<MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
      title={chat.title}
      description={chat.lastMessage}
      statusBadge={getStatusBadge()}
      metadata={metadata}
      onItemClick={() => navigate(`/chats/${chat.id}`)}
      dropdownItems={dropdownItems}
    />
  );
};