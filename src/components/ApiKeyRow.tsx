import { useState } from 'react';
import { CollectionItemRow } from '@/components/CollectionItemRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Key, Eye, EyeOff } from 'lucide-react';
import { ApiKey } from '@/services/apiKeysService';

interface ApiKeyRowProps {
  apiKey: ApiKey;
  onEdit?: (apiKey: ApiKey) => void;
  onDelete?: (apiKey: ApiKey) => void;
}

export const ApiKeyRow = ({ apiKey, onEdit, onDelete }: ApiKeyRowProps) => {
  const [showKey, setShowKey] = useState(false);

  const metadata = [
    {
      icon: <Key className="w-3 h-3 flex-shrink-0" />,
      text: showKey ? 'sk-••••••••••••••••••••••••••••••••••••••••••••' : '•••••••••••••••••••••••'
    }
  ];

  const dropdownItems = [
    ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(apiKey) }] : []),
    ...(onDelete ? [{ label: 'Delete', onClick: () => onDelete(apiKey), destructive: true }] : [])
  ];

  const rightContent = (
    <div className="flex flex-col items-end space-y-2">
      <Badge variant="outline" className="text-xs">
        {apiKey.provider}
      </Badge>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            setShowKey(!showKey);
          }}
        >
          {showKey ? (
            <EyeOff className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )}
        </Button>
        <span className="text-xs text-text-tertiary">
          {new Date(apiKey.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );

  return (
    <CollectionItemRow
      icon={<Key className="w-4 h-4 text-white" />}
      title={apiKey.name}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => console.log('API Key clicked:', apiKey.name)}
      dropdownItems={dropdownItems}
    />
  );
};