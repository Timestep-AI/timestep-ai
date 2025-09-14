import { SettingsItem } from '@/types/settings';
import { CollectionItemRow } from '@/components/CollectionItemRow';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface SettingsRowProps {
  setting: SettingsItem;
}

export const SettingsRow = ({ setting }: SettingsRowProps) => {
  const navigate = useNavigate();

  const metadata = [
    {
      icon: setting.icon,
      text: 'Configuration'
    }
  ];

  const rightContent = (
    <div className="flex items-center">
      <ChevronRight className="w-4 h-4 text-text-tertiary" />
    </div>
  );

  const dropdownItems = [
    {
      label: 'Open',
      onClick: () => navigate(setting.path)
    }
  ];

  return (
    <CollectionItemRow
      icon={setting.icon}
      title={setting.title}
      description={setting.description}
      metadata={metadata}
      rightContent={rightContent}
      onItemClick={() => navigate(setting.path)}
      dropdownItems={dropdownItems}
    />
  );
};