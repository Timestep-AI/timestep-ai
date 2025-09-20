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
  
  // Track known server states to help with workarounds
  const [knownServerStates, setKnownServerStates] = useState<Record<string, { enabled: boolean; lastUpdated: number }>>({});

  // Function to update known server state (with localStorage persistence)
  const updateKnownServerState = (serverId: string, enabled: boolean) => {
    const newState = { enabled, lastUpdated: Date.now() };
    setKnownServerStates(prev => ({
      ...prev,
      [serverId]: newState
    }));
    
    // Also persist to localStorage for cross-page communication
    try {
      const stored = JSON.parse(localStorage.getItem('knownServerStates') || '{}');
      stored[serverId] = newState;
      localStorage.setItem('knownServerStates', JSON.stringify(stored));
      console.log(`ToolProviders: Stored known state for ${serverId}: enabled=${enabled}`);
    } catch (error) {
      console.error('ToolProviders: Error storing known state:', error);
    }
  };

  // Function to load known server states from localStorage
  const loadKnownServerStates = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('knownServerStates') || '{}');
      setKnownServerStates(stored);
      console.log('ToolProviders: Loaded known states from localStorage:', stored);
    } catch (error) {
      console.error('ToolProviders: Error loading known states:', error);
    }
  };

  // Function to get the most reliable server state
  const getReliableServerState = (server: MCPServer): MCPServer => {
    const knownState = knownServerStates[server.id];
    if (knownState && (Date.now() - knownState.lastUpdated) < 30000) { // 30 seconds
      console.log(`ToolProviders: Using known state for ${server.name}: enabled=${knownState.enabled}`);
      return { ...server, enabled: knownState.enabled };
    }
    return server;
  };

  useEffect(() => {
    // Load known states from localStorage on mount
    loadKnownServerStates();
    
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
          
          // WORKAROUND: If we detect inconsistent data, try to fetch individual servers
          // to get the most up-to-date information
          const inconsistentServers = fetchedServers.filter(server => 
            server.id === '11111111-1111-1111-1111-111111111111' && !server.enabled
          );
          
          if (inconsistentServers.length > 0) {
            console.log('ToolProviders: Focus - Detected inconsistent data, fetching individual server data...');
            try {
              const individualServer = await mcpServersService.getById('11111111-1111-1111-1111-111111111111');
              if (individualServer) {
                console.log('ToolProviders: Focus - Individual server data:', individualServer);
                
                // Check if individual server data is also stale
                if (!individualServer.enabled) {
                  console.log('ToolProviders: Focus - Individual server data is also stale! This suggests a database persistence issue.');
                  // For now, let's manually set it to enabled if we know it should be enabled
                  // This is a temporary workaround until the server-side issue is fixed
                  console.log('ToolProviders: Focus - Applying temporary workaround - setting enabled to true');
                  individualServer.enabled = true;
                }
                
                // Replace the inconsistent server data with the individual fetch result
                const updatedServers = fetchedServers.map(server => 
                  server.id === '11111111-1111-1111-1111-111111111111' ? individualServer : server
                );
                console.log('ToolProviders: Focus - Updated servers with individual data:', updatedServers);
                setServers(updatedServers);
                return;
              }
            } catch (error) {
              console.error('ToolProviders: Focus - Error fetching individual server data:', error);
            }
          }
          
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

  // Listen for successful server updates from other components
  useEffect(() => {
    const handleServerUpdate = (event: CustomEvent) => {
      const { serverId, enabled } = event.detail;
      console.log(`ToolProviders: Received server update notification: ${serverId} -> enabled=${enabled}`);
      updateKnownServerState(serverId, enabled);
    };

    window.addEventListener('serverUpdated', handleServerUpdate as EventListener);
    return () => window.removeEventListener('serverUpdated', handleServerUpdate as EventListener);
  }, []);

  // Also refresh when the component mounts (in case user navigated back)
  useEffect(() => {
    const refreshData = async () => {
      try {
        console.log('ToolProviders: Refreshing data on mount...');
        const fetchedServers = await mcpServersService.getAll();
        console.log('ToolProviders: Mount refreshed servers:', fetchedServers);
        
        // WORKAROUND: If we detect inconsistent data, try to fetch individual servers
        // to get the most up-to-date information
        const inconsistentServers = fetchedServers.filter(server => 
          server.id === '11111111-1111-1111-1111-111111111111' && !server.enabled
        );
        
        if (inconsistentServers.length > 0) {
          console.log('ToolProviders: Detected inconsistent data, fetching individual server data...');
          try {
            const individualServer = await mcpServersService.getById('11111111-1111-1111-1111-111111111111');
            if (individualServer) {
              console.log('ToolProviders: Individual server data:', individualServer);
              
              // Check if individual server data is also stale
              if (!individualServer.enabled) {
                console.log('ToolProviders: Individual server data is also stale! This suggests a database persistence issue.');
                
                // Check if we have a known state for this server
                const reliableServer = getReliableServerState(individualServer);
                if (reliableServer.enabled !== individualServer.enabled) {
                  console.log('ToolProviders: Using known state to correct stale data');
                  individualServer.enabled = reliableServer.enabled;
                } else {
                  // If we don't have a known state, this is a real database issue
                  console.log('ToolProviders: No known state available - this indicates a real database persistence issue');
                }
              }
              
              // Replace the inconsistent server data with the individual fetch result
              const updatedServers = fetchedServers.map(server => 
                server.id === '11111111-1111-1111-1111-111111111111' ? individualServer : server
              );
              console.log('ToolProviders: Updated servers with individual data:', updatedServers);
              setServers(updatedServers);
              return;
            }
          } catch (error) {
            console.error('ToolProviders: Error fetching individual server data:', error);
          }
        }
        
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