import { useState, useEffect } from 'react';
import { CollectionPage } from '@/components/CollectionPage';
import { AgentRow } from '@/components/AgentRow';
import { Plus } from 'lucide-react';
import { Agent } from '@/types/agent';
import { agentsService } from '@/services/agentsService';

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
      setAgents(agentsList);
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
    console.log('Delete not implemented - server does not support agent deletion');
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