import { CollectionItemRow } from '@/components/CollectionItemRow';
import { Badge } from '@/components/ui/badge';
import { Building2, Globe, CheckCircle, XCircle } from 'lucide-react';
import { ModelProvider } from '@/services/modelProvidersService';

interface ModelProviderRowProps {
  provider: ModelProvider;
  onEdit?: (provider: ModelProvider) => void;
  onDelete?: (provider: ModelProvider) => void;
}

export const ModelProviderRow = ({ provider, onEdit, onDelete }: ModelProviderRowProps) => {
  const isConfigured = !!provider.apiKey;

  const metadata = [
    {
      icon: <Globe className="w-3 h-3 flex-shrink-0" />,
      text: provider.baseUrl
    },
    {
      icon: isConfigured ? <CheckCircle className="w-3 h-3 flex-shrink-0 text-success" /> : <XCircle className="w-3 h-3 flex-shrink-0 text-destructive" />,
      text: isConfigured ? 'API Key Configured' : 'API Key Not Configured'
    }
  ];

  const dropdownItems = [
    ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(provider) }] : []),
    ...(onDelete ? [{ label: 'Delete', onClick: () => onDelete(provider), destructive: true }] : [])
  ];

  const rightContent = (
    <div className="flex flex-col items-end space-y-1">
      <Badge 
        variant={isConfigured ? 'default' : 'secondary'}
        className="text-xs"
      >
        {isConfigured ? 'Active' : 'Inactive'}
      </Badge>
      <span className="text-xs text-text-tertiary">
        {new Date(provider.createdAt).toLocaleDateString()}
      </span>
    </div>
  );

  return (
    <CollectionItemRow
      icon={<Building2 className="w-4 h-4 text-white" />}
      title={provider.provider}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => window.location.href = `/model_providers/${provider.id}`}
      dropdownItems={dropdownItems}
    />
  );
};