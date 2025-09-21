import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { MCPServerRow } from '@/components/MCPServerRow';
import { Settings } from 'lucide-react';
import { MCPServer } from '@/types/mcpServer';
import { mcpServersService } from '@/services/mcpServersService';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ToolProviders = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);
  


  useEffect(() => {
    const loadToolProviders = async () => {
      try {
        setLoading(true);
        const fetchedServers = await mcpServersService.getAll();
        setServers(fetchedServers);
      } catch (error) {
        console.error('Error loading tool providers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadToolProviders();
  }, []);

  // Refresh data when the window gains focus (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      // Refresh the data when user comes back to this page
      const refreshData = async () => {
        try {
        console.log('ToolProviders: Refreshing data on focus...');
        const fetchedServers = await mcpServersService.getAll();
        console.log('ToolProviders: Refreshed servers:', fetchedServers);
        
        // Debug: Log the specific server we're interested in
        const rubeServer = fetchedServers.find(s => s.id === '11111111-1111-1111-1111-111111111111');
        if (rubeServer) {
          console.log('ToolProviders: Focus - Rube server from list:', rubeServer);
        }
          
          // Data should now be consistent between list and individual endpoints
          
          // Log each server's enabled status for debugging
          fetchedServers.forEach((server, index) => {
            console.log(`ToolProviders: Server ${index} (${server.name}): enabled=${server.enabled}, hasAuthToken=${(server as any).hasAuthToken}`);
          });
          setServers(fetchedServers);
        } catch (error) {
          console.error('Error refreshing tool providers:', error);
        }
      };
      refreshData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);


  // Also refresh when the component mounts (in case user navigated back)
  useEffect(() => {
    const refreshData = async () => {
      try {
        console.log('ToolProviders: Refreshing data on mount...');
        const fetchedServers = await mcpServersService.getAll();
        console.log('ToolProviders: Mount refreshed servers:', fetchedServers);
        
        // Debug: Log the specific server we're interested in
        const rubeServer = fetchedServers.find(s => s.id === '11111111-1111-1111-1111-111111111111');
        if (rubeServer) {
          console.log('ToolProviders: Mount - Rube server from list:', rubeServer);
        }
        
        // Data should now be consistent between list and individual endpoints
        
        // Log each server's enabled status for debugging
        fetchedServers.forEach((server, index) => {
          console.log(`ToolProviders: Mount Server ${index} (${server.name}): enabled=${server.enabled}, hasAuthToken=${(server as any).hasAuthToken}`);
        });
        setServers(fetchedServers);
      } catch (error) {
        console.error('Error refreshing tool providers on mount:', error);
      }
    };

    // Only refresh if we don't already have data (to avoid unnecessary calls)
    if (servers.length === 0) {
      refreshData();
    }
  }, [servers.length]);

  const handleEdit = (server: MCPServer) => {
    console.log('Edit tool provider:', server);
  };

  const handleDelete = async (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      setServerToDelete(server);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!serverToDelete) return;
    
    try {
      setOperationLoading(true);
      
      const success = await mcpServersService.delete(serverToDelete.id);
      if (success) {
        setServers(prevServers => prevServers.filter(s => s.id !== serverToDelete.id));
        toast.success('Tool provider deleted successfully');
      } else {
        toast.error('Tool provider not found');
      }
    } catch (error) {
      console.error('Error deleting tool provider:', error);
      toast.error('Failed to delete tool provider');
    } finally {
      setOperationLoading(false);
      setDeleteDialogOpen(false);
      setServerToDelete(null);
    }
  };

  return (
    <>
      <CollectionPage
        title="Tool Providers"
        items={servers}
        loading={loading}
        operationLoading={operationLoading}
        emptyIcon={<Settings className="text-4xl text-text-tertiary" />}
        emptyTitle="No tool providers found"
        emptyDescription="Get started by configuring your first tool provider."
        searchPlaceholder="Search tool providers..."
        renderItem={(server) => (
          <MCPServerRow
            key={server.id}
            server={server}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{serverToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ToolProviders;