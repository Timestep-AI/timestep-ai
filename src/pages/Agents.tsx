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
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);

  // Load agents on component mount
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
      showToastMessage('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaults = async () => {
    try {
      setOperationLoading(true);
      const defaultAgents = await agentsService.createDefaults();
      setAgents(defaultAgents);
      showToastMessage(`Created ${defaultAgents.length} default agents`);
    } catch (error) {
      console.error('Failed to create default agents:', error);
      showToastMessage('Failed to create default agents');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setOperationLoading(true);
      await agentsService.deleteAll();
      setAgents([]);
      showToastMessage('All agents deleted');
    } catch (error) {
      console.error('Failed to delete all agents:', error);
      showToastMessage('Failed to delete all agents');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleEditAgent = async (agent: Agent) => {
    console.log('Editing agent:', agent);
    // TODO: Implement edit modal/form
    showToastMessage(`Edit functionality coming soon for ${agent.name}`);
  };

  const handleDeleteAgent = async (agent: Agent) => {
    try {
      setOperationLoading(true);
      const success = await agentsService.delete(agent.id);
      if (success) {
        setAgents(prevAgents => prevAgents.filter(a => a.id !== agent.id));
        showToastMessage(`Deleted ${agent.name}`);
      } else {
        showToastMessage('Failed to delete agent');
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      showToastMessage('Failed to delete agent');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    console.log('Creating new agent...');
    // TODO: Implement create modal/form
    showToastMessage('Create functionality coming soon');
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
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
      itemCountLabel={(count) => `${count} agent${count !== 1 ? 's' : ''}`}
      onCreateDefaults={handleCreateDefaults}
      onDeleteAll={handleDeleteAll}
      onCreate={handleCreateAgent}
      renderItem={(agent) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          onEdit={handleEditAgent}
          onDelete={handleDeleteAgent}
        />
      )}
      showSearch={true}
      showDeleteAll={true}
      showCreateButton={true}
      toastMessage={toastMessage}
      showToast={showToast}
    />
  );
};

export default Agents;