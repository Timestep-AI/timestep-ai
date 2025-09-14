import { CollectionPage } from '@/components/CollectionPage';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsItem } from '@/types/settings';
import { Server } from 'lucide-react';

const Settings = () => {
  const settingsItems: SettingsItem[] = [
    {
      id: 'mcp-servers',
      title: 'MCP Servers',
      description: 'Configure and manage Model Context Protocol servers',
      icon: <Server className="w-5 h-5 text-white" />,
      path: '/settings/mcp_servers'
    }
  ];

  const handleCreateDefaults = async () => {
    // No-op for settings
  };

  return (
    <CollectionPage<SettingsItem>
      title="Settings"
      items={settingsItems}
      loading={false}
      emptyIcon={<Server className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No settings available"
      emptyDescription="There are no configurable settings at this time."
      searchPlaceholder="Search settings..."
      itemCountLabel={(count) => `${count} setting${count !== 1 ? 's' : ''}`}
      onCreateDefaults={handleCreateDefaults}
      renderItem={(setting) => (
        <SettingsRow key={setting.id} setting={setting} />
      )}
      showSearch={false}
      showDeleteAll={false}
      showCreateButton={false}
    />
  );
};

export default Settings;