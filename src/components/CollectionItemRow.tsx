import { ReactNode } from 'react';

interface MetadataItem {
  icon: ReactNode;
  text: string;
}

interface DropdownItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

interface CollectionItemRowProps {
  icon: ReactNode;
  title: string;
  description?: string;
  statusBadge?: ReactNode;
  metadata: MetadataItem[];
  rightContent?: ReactNode;
  onItemClick: () => void;
  dropdownItems?: DropdownItem[];
}

export const CollectionItemRow = ({
  icon,
  title,
  description,
  statusBadge,
  metadata,
  rightContent,
  onItemClick,
  dropdownItems
}: CollectionItemRowProps) => {
  const handleRowClick = () => {
    onItemClick();
  };

  return (
    <div 
      className="border border-muted-foreground/80 rounded-xl p-4 hover:border-muted-foreground transition-all duration-200 cursor-pointer bg-card"
      onClick={handleRowClick}
    >
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-foreground text-base">
                {title}
              </h3>
              {statusBadge}
            </div>
            <div className="flex items-center space-x-2">
              {rightContent}
            </div>
          </div>
          
          {description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {description}
            </p>
          )}
          
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            {metadata.map((item, index) => (
              <div key={index} className="flex items-center space-x-1">
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};