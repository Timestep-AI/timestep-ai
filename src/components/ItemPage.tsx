import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

interface ItemPageProps {
  loading: boolean;
  item: any;
  itemType: string;
  backPath: string;
  backLabel: string;
  icon: ReactNode;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  statusBadge?: ReactNode;
  children?: ReactNode;
}

export function ItemPage({
  loading,
  item,
  itemType,
  backPath,
  backLabel,
  icon,
  onEdit,
  onDelete,
  statusBadge,
  children
}: ItemPageProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-text-secondary">Loading {itemType.toLowerCase()}...</div>
        </div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-text-secondary mb-4">{itemType} not found</div>
          <Button onClick={() => navigate(backPath)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(backPath)}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button onClick={onEdit} variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button onClick={onDelete} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Item Overview */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-2xl font-bold text-text-primary">
                  {item.name || item.title}
                </h1>
                {statusBadge}
              </div>
              
              {item.description && (
                <p className="text-text-secondary mb-4">
                  {item.description}
                </p>
              )}
            </div>
          </div>
          
          {children}
        </div>
      </div>
    </Layout>
  );
}