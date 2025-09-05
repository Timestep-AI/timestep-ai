import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { IonicAgentCard } from '@/components/IonicAgentCard';
import { 
  IonButton, 
  IonIcon, 
  IonFab, 
  IonFabButton,
  IonButtons,
  IonSearchbar,
  IonLoading,
  IonToast
} from '@ionic/react';
import { add, trash, download } from 'ionicons/icons';
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
      <IonLoading isOpen={loading} message="Loading agents..." />
      <IonLoading isOpen={operationLoading} message="Please wait..." />
      
      <div className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <IonButton 
              onClick={handleCreateDefaults}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="small"
              disabled={operationLoading}
            >
              <IonIcon icon={download} slot="start" />
              CREATE DEFAULTS
            </IonButton>
            
            <IonButton 
              color="danger"
              onClick={handleDeleteAll}
              disabled={agents.length === 0 || operationLoading}
              size="small"
            >
              <IonIcon icon={trash} slot="start" />
              DELETE ALL
            </IonButton>
          </div>
          
          <div className="text-sm text-text-secondary">
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden">
          <IonSearchbar
            placeholder="Search agents..."
            style={{ '--background': 'hsl(var(--background))', '--color': 'hsl(var(--foreground))' }}
            showClearButton="focus"
          />
        </div>

        {/* Agents List */}
        <div className="space-y-3">
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                <IonIcon icon={add} className="text-4xl text-text-tertiary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No agents yet
              </h3>
              <p className="text-text-secondary mb-4 px-4">
                Create your first agent to get started with AI workflows.
              </p>
              <IonButton 
                onClick={handleCreateDefaults}
                className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
                disabled={operationLoading}
              >
                <IonIcon icon={add} slot="start" />
                Create Defaults
              </IonButton>
            </div>
          ) : (
            agents.map((agent) => (
              <IonicAgentCard
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
      <IonFab vertical="bottom" horizontal="end" slot="fixed">
        <IonFabButton 
          className="bg-gradient-primary"
          onClick={handleCreateAgent}
          disabled={operationLoading}
        >
          <IonIcon icon={add} className="text-white" />
        </IonFabButton>
      </IonFab>

      {/* Toast for notifications */}
      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        position="bottom"
        className="custom-toast"
      />
    </Layout>
  );
};

export default Agents;