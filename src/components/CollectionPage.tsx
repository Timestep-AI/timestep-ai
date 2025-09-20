import { useState, useEffect, ReactNode } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CollectionPageProps<T> {
  title: string;
  items: T[];
  loading: boolean;
  operationLoading?: boolean;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  renderItem: (item: T) => ReactNode;
  onDeleteAll?: () => void;
  showDeleteAll?: boolean;
  backPath?: string;
  backLabel?: string;
  actionButton?: ReactNode;
}

export const CollectionPage = <T,>({
  title,
  items,
  loading,
  operationLoading = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  searchPlaceholder = "Search...",
  onSearch,
  renderItem,
  onDeleteAll,
  showDeleteAll = false,
  backPath,
  backLabel,
  actionButton
}: CollectionPageProps<T>) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const searchableFields = [
      (item as any).name,
      (item as any).title,
      (item as any).description,
      (item as any).provider,
      (item as any).sender,
    ].filter(Boolean);
    
    const arrayFields = [
      (item as any).capabilities,
      (item as any).participants,
    ].filter(Boolean);
    
    const matchesBasicFields = searchableFields.some(field => 
      field.toLowerCase().includes(searchLower)
    );
    
    const matchesArrayFields = arrayFields.some(array => 
      array.some((element: string) => element.toLowerCase().includes(searchLower))
    );
    
    return matchesBasicFields || matchesArrayFields;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading {title.toLowerCase()}...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {operationLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border">
            <p className="text-foreground">Please wait...</p>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {backPath && backLabel && (
          <Button
            variant="ghost"
            onClick={() => navigate(backPath)}
            className="text-foreground hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
        )}
        
        
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              className="pl-10 w-80 bg-surface border border-muted-foreground/60 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          
          <div className="flex items-center gap-4">
            {actionButton}
            {showDeleteAll && onDeleteAll && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={onDeleteAll}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </Button>
            )}
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          {filteredItems.length} of {items.length} {items.length !== 1 ? 'items' : 'item'}
        </div>

        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                {emptyIcon}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {emptyTitle}
              </h3>
              <p className="text-muted-foreground mb-4 px-4">
                {emptyDescription}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => renderItem(item))
          )}
        </div>
      </div>
    </Layout>
  );
};