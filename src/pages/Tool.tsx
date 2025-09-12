import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { 
  Wrench, 
  Calendar, 
  Activity, 
  Shield, 
  Tag, 
  BarChart3,
  Clock,
  Settings
} from 'lucide-react';
import { Tool as ToolType } from '@/types/tool';
import { toolsService } from '@/services/toolsService';

export const ToolPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<ToolType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTool = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const foundTool = await toolsService.getById(id);
        setTool(foundTool || null);
      } catch (error) {
        console.error('Error loading tool:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTool();
  }, [id]);

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit tool:', tool);
  };

  const handleDelete = async () => {
    if (!tool) return;
    
    try {
      await toolsService.delete(tool.id);
      navigate('/tools');
    } catch (error) {
      console.error('Error deleting tool:', error);
    }
  };

  const getCategoryColor = (category: ToolType['category']) => {
    switch (category) {
      case 'development':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'productivity':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'communication':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'analysis':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'automation':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusBadge = () => {
    if (!tool) return null;
    
    switch (tool.status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'maintenance':
        return <Badge variant="outline">Maintenance</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ItemPage
      loading={loading}
      item={tool}
      itemType="Tool"
      backPath="/tools"
      backLabel="Back to Tools"
      icon={<Wrench className="w-8 h-8 text-primary-foreground" />}
      onEdit={handleEdit}
      onDelete={handleDelete}
      statusBadge={getStatusBadge()}
    >
      {tool && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Updated: {new Date(tool.updatedAt).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(tool.category)}`}>
                {tool.category}
              </span>
            </div>
          </div>

          {/* Tool Specifications */}
          <div className="border-t border-border pt-6 mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Usage Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-info" />
                <div>
                  <label className="text-sm font-medium text-text-secondary">Monthly Usage</label>
                  <p className="text-text-primary">{tool.usage.monthly} times</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5 text-success" />
                <div>
                  <label className="text-sm font-medium text-text-secondary">Weekly Usage</label>
                  <p className="text-text-primary">{tool.usage.weekly} times</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5 text-warning" />
                <div>
                  <label className="text-sm font-medium text-text-secondary">Daily Usage</label>
                  <p className="text-text-primary">{tool.usage.daily} times</p>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="border-t border-border pt-6 mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Permissions</h3>
            <div className="flex flex-wrap gap-2">
              {tool.permissions.map((permission) => (
                <Badge 
                  key={permission} 
                  className="bg-info/10 text-info border-info/20"
                >
                  {permission}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Additional Details */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">ID</label>
                <p className="text-text-primary font-mono text-sm break-all">{tool.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Version</label>
                <p className="text-text-primary">v{tool.version}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Enabled</label>
                <p className="text-text-primary">{tool.isEnabled ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Status</label>
                <p className="text-text-primary capitalize">{tool.status}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Created</label>
                <p className="text-text-primary">{new Date(tool.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Last Used</label>
                <p className="text-text-primary">
                  {tool.lastUsed ? formatDate(tool.lastUsed) : 'Never'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default ToolPage;