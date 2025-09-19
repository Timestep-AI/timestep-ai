import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { AgentRow } from '@/components/AgentRow';
import { Plus } from 'lucide-react';
import { Agent } from '@/types/agent';
import { agentsService } from '@/services/agentsService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const agentsList = await agentsService.getAll();
      
      // Sort agents: non-handoffs first, then by name, then by id
      const sortedAgents = agentsList.sort((a, b) => {
        // Primary sort: handoffs come last (isHandoff: false comes before isHandoff: true)
        if (a.isHandoff !== b.isHandoff) {
          return a.isHandoff ? 1 : -1;
        }
        
        // Secondary sort: by name (alphabetical)
        const nameComparison = a.name.localeCompare(b.name);
        if (nameComparison !== 0) {
          return nameComparison;
        }
        
        // Tertiary sort: by id (alphabetical)
        return a.id.localeCompare(b.id);
      });
      
      setAgents(sortedAgents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEditAgent = async (agent: Agent) => {
    console.log('Edit not implemented - server does not support agent updates');
  };

  const handleDeleteAgent = async (agent: Agent) => {
    try {
      setOperationLoading(true);
      
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agent.id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error('Error deleting agent:', error);
        toast.error('Failed to delete agent');
        return;
      }

      // Remove agent from local state
      setAgents(prevAgents => prevAgents.filter(a => a.id !== agent.id));
      toast.success('Agent deleted successfully');
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <CollectionPage
      title="Agents"
      items={agents}
      loading={loading}
      operationLoading={operationLoading}
      emptyIcon={<Plus className="w-8 h-8 text-text-tertiary" />}
      emptyTitle="No agents yet"
      emptyDescription="Create your first agent to get started with AI workflows."
      searchPlaceholder="Search agents..."
      renderItem={(agent) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          onEdit={handleEditAgent}
          onDelete={handleDeleteAgent}
        />
      )}
    />
  );
};

export default Agents;