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
  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown menu
    if ((e.target as HTMLElement).closest('[data-dropdown-trigger]')) {
      return;
    }
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
              {dropdownItems && dropdownItems.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild data-dropdown-trigger>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {dropdownItems.map((item, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          item.onClick();
                        }}
                        className={item.destructive ? "text-destructive" : ""}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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