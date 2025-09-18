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
  
  // Ensure items is always an array to prevent filter errors
  const safeItems = Array.isArray(items) ? items : [];
  
  const filteredItems = safeItems.filter(item => {
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
          <div className="text-text-secondary">Loading {title.toLowerCase()}...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {operationLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg">
            <p className="text-text-primary">Please wait...</p>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        {backPath && backLabel && (
          <Button
            variant="ghost"
            onClick={() => navigate(backPath)}
            className="mb-4 -ml-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
        )}
        
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary w-4 h-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch?.(e.target.value);
                }}
                className="pl-10 w-64"
              />
            </div>
          <div className="flex items-center space-x-2">
            {actionButton}
            {showDeleteAll && onDeleteAll && (
              <Button 
                variant="destructive"
                size="default"
                onClick={onDeleteAll}
                disabled={safeItems.length === 0 || operationLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                DELETE ALL
              </Button>
            )}
          </div>
          </div>
          
          <div className="text-xs text-text-secondary text-center sm:text-right">
            {filteredItems.length} of {safeItems.length} {safeItems.length !== 1 ? 'items' : 'item'}
          </div>
        </div>

        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                {emptyIcon}
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {emptyTitle}
              </h3>
              <p className="text-text-secondary mb-4 px-4">
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