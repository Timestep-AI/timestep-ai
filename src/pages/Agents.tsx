import { useState } from 'react';
import { IonicLayout } from '@/components/IonicLayout';
import { IonicAgentCard } from '@/components/IonicAgentCard';
import { 
  IonButton, 
  IonIcon, 
  IonFab, 
  IonFabButton,
  IonButtons,
  IonSearchbar
} from '@ionic/react';
import { add, trash, download } from 'ionicons/icons';

// Mock data
const mockAgents = [
  {
    id: '1',
    name: 'Personal Assistant',
    description: 'A versatile AI assistant for personal productivity and task management.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active' as const,
  },
  {
    id: '2',
    name: 'Administrative Assistant',
    description: 'Handles administrative tasks and office management duties.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff' as const,
  },
  {
    id: '3',
    name: 'Communications Coordinator',
    description: 'Manages internal and external communications across teams.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff' as const,
    model: 'meta/llama-3.2-11b-vision-instruct',
  },
  {
    id: '4',
    name: 'Project Coordinator',
    description: 'Oversees project timelines, resources, and team coordination.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff' as const,
  },
  {
    id: '5',
    name: 'Research Specialist',
    description: 'Conducts thorough research and analysis on various topics.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff' as const,
  },
  {
    id: '6',
    name: 'Scheduling Coordinator',
    description: 'Manages calendars, appointments, and scheduling conflicts.',
    createdAt: '8/31/2025, 3:06:27 PM',
    status: 'handoff' as const,
  },
];

export const Agents = () => {
  const [agents, setAgents] = useState(mockAgents);

  const handleCreateDefaults = () => {
    // In a real app, this would create default agents
    console.log('Creating default agents...');
  };

  const handleDeleteAll = () => {
    // In a real app, this would show a confirmation dialog
    setAgents([]);
  };

  const handleEditAgent = (agent: any) => {
    console.log('Editing agent:', agent);
    // In a real app, this would open an edit modal
  };

  const handleDeleteAgent = (agent: any) => {
    setAgents(prev => prev.filter(a => a.id !== agent.id));
  };

  return (
    <IonicLayout title="Agents">
      <div className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <IonButton 
              onClick={handleCreateDefaults}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="small"
            >
              <IonIcon icon={download} slot="start" />
              CREATE DEFAULTS
            </IonButton>
            
            <IonButton 
              color="danger"
              onClick={handleDeleteAll}
              disabled={agents.length === 0}
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
              >
                <IonIcon icon={add} slot="start" />
                Create Agent
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
        <IonFabButton className="bg-gradient-primary">
          <IonIcon icon={add} className="text-white" />
        </IonFabButton>
      </IonFab>
    </IonicLayout>
  );
};

export default Agents;