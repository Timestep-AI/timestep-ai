import { MoreHorizontal } from 'lucide-react';
import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  dropdownItems: DropdownItem[];
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
  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown menu
    if ((e.target as HTMLElement).closest('[data-dropdown-trigger]')) {
      return;
    }
    onItemClick();
  };

  return (
    <div 
      className="bg-card border border-border rounded-xl p-3 sm:p-4 hover:bg-surface-elevated transition-all duration-200 group cursor-pointer"
      onClick={handleRowClick}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0 mb-3 sm:mb-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start space-x-2 mb-1">
              <h3 className="font-semibold text-text-primary text-sm sm:text-base break-words">
                {title}
              </h3>
              {statusBadge}
            </div>
            
            {description && (
              <p className="text-xs sm:text-sm text-text-secondary mb-2 break-words line-clamp-2">
                {description}
              </p>
            )}
            
            <div className="flex items-center flex-wrap gap-1 sm:gap-3 text-xs text-text-tertiary">
              {metadata.map((item, index) => (
                <div key={index} className="flex items-center space-x-1">
                  {item.icon}
                  <span className="break-all">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between sm:flex-col sm:items-end space-x-2 sm:space-x-0 sm:space-y-1 flex-shrink-0">
          {rightContent}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                data-dropdown-trigger
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {dropdownItems.map((item, index) => (
                <DropdownMenuItem 
                  key={index}
                  onClick={item.onClick}
                  className={item.destructive ? "text-destructive" : ""}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};