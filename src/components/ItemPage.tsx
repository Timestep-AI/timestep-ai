import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

interface ItemPageProps {
  loading: boolean;
  item: any;
  itemType: string;
  backPath: string;
  backLabel: string;
  icon: ReactNode;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
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
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    
    try {
      setDeleteLoading(true);
      await onDelete();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading {itemType.toLowerCase()}...</div>
        </div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-muted-foreground mb-4">{itemType} not found</div>
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
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(backPath)}
            className="text-foreground hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
          
          {(onEdit || onDelete) && (
            <div className="flex items-center space-x-2">
              {onEdit && (
                <Button onClick={onEdit} variant="outline" size="sm" className="text-primary border-border hover:bg-accent">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleteLoading}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleteLoading ? 'Deleting...' : 'Delete'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {itemType}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{item.name || item.title}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteLoading ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>

        {/* Item Header */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {item.name || item.title}
                </h1>
                {statusBadge}
              </div>
              
              {item.description && (
                <p className="text-muted-foreground text-base">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {children}
      </div>
    </Layout>
  );
}