import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { AgentRow } from '@/components/AgentRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateDefaultsButton } from '@/components/CreateDefaultsButton';
import { Plus, Trash2, Search } from 'lucide-react';
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
              onClick={handleCreateDefaults}
              disabled={operationLoading}
            />
            
            <Button 
              variant="destructive"
              size="default"
              onClick={handleDeleteAll}
              disabled={agents.length === 0 || operationLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              DELETE ALL
            </Button>
          </div>
          
          <div className="text-xs text-text-secondary text-center sm:text-right">
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Search Bar */}
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input
              placeholder="Search agents..."
              className="pl-10 bg-background border-border"
            />
          </div>
        </div>

        {/* Agents List */}
        <div className="space-y-3">
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-text-tertiary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No agents yet
              </h3>
              <p className="text-text-secondary mb-4 px-4">
                Create your first agent to get started with AI workflows.
              </p>
              <CreateDefaultsButton 
                onClick={handleCreateDefaults}
                disabled={operationLoading}
              />
            </div>
          ) : (
            agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                onEdit={handleEditAgent}
                onDelete={handleDeleteAgent}
              />
            ))
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 bg-gradient-primary rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-40"
        onClick={handleCreateAgent}
        disabled={operationLoading}
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 shadow-lg z-50">
          <p className="text-text-primary">{toastMessage}</p>
        </div>
      )}
    </Layout>
  );
};

export default Agents;