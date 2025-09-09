import { useState, useEffect, ReactNode } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateDefaultsButton } from '@/components/CreateDefaultsButton';
import { Plus, Trash2, Search } from 'lucide-react';

interface CollectionPageProps<T> {
  title: string;
  items: T[];
  loading: boolean;
  operationLoading?: boolean;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  searchPlaceholder: string;
  itemCountLabel: (count: number) => string;
  onCreateDefaults: () => Promise<void>;
  onDeleteAll?: () => Promise<void>;
  onCreate?: () => Promise<void>;
  renderItem: (item: T) => ReactNode;
  showSearch?: boolean;
  showDeleteAll?: boolean;
  showCreateButton?: boolean;
  toastMessage?: string;
  showToast?: boolean;
}

export function CollectionPage<T extends { id: string }>({
  title,
  items,
  loading,
  operationLoading = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  searchPlaceholder,
  itemCountLabel,
  onCreateDefaults,
  onDeleteAll,
  onCreate,
  renderItem,
  showSearch = true,
  showDeleteAll = false,
  showCreateButton = false,
  toastMessage = '',
  showToast = false
}: CollectionPageProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter(item => {
    // This assumes items have a 'name' or 'title' property for search
    const searchableText = (item as any).name || (item as any).title || '';
    return searchableText.toLowerCase().includes(searchTerm.toLowerCase());
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
        {/* Action Buttons */}
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <CreateDefaultsButton 
              onClick={onCreateDefaults}
              disabled={operationLoading}
            />
            
            {showDeleteAll && onDeleteAll && (
              <Button 
                variant="destructive"
                size="default"
                onClick={onDeleteAll}
                disabled={items.length === 0 || operationLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                DELETE ALL
              </Button>
            )}
          </div>
          
          <div className="text-xs text-text-secondary text-center sm:text-right">
            {itemCountLabel(filteredItems.length)}
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-10 bg-background border-border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Items List */}
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
              <CreateDefaultsButton 
                onClick={onCreateDefaults}
                disabled={operationLoading}
              />
            </div>
          ) : (
            filteredItems.map((item) => renderItem(item))
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      {showCreateButton && onCreate && (
        <button
          className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 bg-gradient-primary rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-40"
          onClick={onCreate}
          disabled={operationLoading}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Toast notification */}
      {showToast && toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 shadow-lg z-50">
          <p className="text-text-primary">{toastMessage}</p>
        </div>
      )}
    </Layout>
  );
}