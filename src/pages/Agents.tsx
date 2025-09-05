import { useState } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { ModernAgentCard } from '@/components/ModernAgentCard';
import { Button } from '@/components/ui/button';
import { Plus, Download, Trash2 } from 'lucide-react';

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
    <ModernLayout>
      <div className="space-y-6">
        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              onClick={handleCreateDefaults}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              CREATE DEFAULTS
            </Button>
            
            <Button 
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={agents.length === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              DELETE ALL
            </Button>
          </div>
          
          <div className="text-sm text-gray-500">
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Agents List */}
        <div className="space-y-3">
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No agents yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first agent to get started with AI workflows.
              </p>
              <Button 
                onClick={handleCreateDefaults}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </div>
          ) : (
            agents.map((agent) => (
              <ModernAgentCard
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
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-110">
        <Plus className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
      </button>
    </ModernLayout>
  );
};

export default Agents;