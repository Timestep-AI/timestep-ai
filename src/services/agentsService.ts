import { Agent, CreateAgentRequest, UpdateAgentRequest } from '@/types/agent';

const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

class AgentsService {
  async getAll(): Promise<Agent[]> {
    try {
      console.log('AgentsService: Fetching from', `${SERVER_BASE_URL}/agents`);
      const response = await fetch(`${SERVER_BASE_URL}/agents`);
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }
      const apiAgents = await response.json();
      console.log('AgentsService: Raw API response:', apiAgents);
      
      // If empty array, return empty array
      if (!Array.isArray(apiAgents) || apiAgents.length === 0) {
        return [];
      }
      
      // Map server response to our Agent interface
      const agents: Agent[] = apiAgents.map((apiAgent: any) => {
        return {
          id: apiAgent.id,
          name: apiAgent.name,
          description: apiAgent.handoff_description || 'AI Agent', // Use real description from server
          instructions: apiAgent.instructions || '',
          handoffIds: apiAgent.handoff_ids || [],
          handoffDescription: apiAgent.handoff_description || '',
          createdAt: apiAgent.created_at || new Date().toISOString(),
          model: apiAgent.model,
          modelSettings: apiAgent.model_settings || {},
          status: 'active' as const,
          isHandoff: Boolean(apiAgent.handoff_description), // Agent is a handoff if it has a handoff description
          toolIds: apiAgent.tool_ids || []
        };
      });
      
      return agents;
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Agent | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents/${id}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.statusText}`);
      }
      const agent = await response.json();
      return agent;
    } catch (error) {
      console.error('Error fetching agent:', error);
      throw error;
    }
  }

  async create(request: CreateAgentRequest): Promise<Agent> {
    // Note: Server doesn't support agent creation yet
    throw new Error('Agent creation not implemented in server');
  }

  async update(id: string, request: UpdateAgentRequest): Promise<Agent | null> {
    // Note: Server doesn't support agent updates yet
    throw new Error('Agent update not implemented in server');
  }

  async delete(id: string): Promise<boolean> {
    // Note: Server doesn't support agent deletion yet
    throw new Error('Agent deletion not implemented in server');
  }

  async deleteAll(): Promise<void> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete all agents: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting all agents:', error);
      throw error;
    }
  }

  async getCount(): Promise<number> {
    try {
      const agents = await this.getAll();
      return agents.length;
    } catch (error) {
      console.error('Error getting agent count:', error);
      throw error;
    }
  }

  async search(query: string): Promise<Agent[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to search agents: ${response.statusText}`);
      }
      
      const agents = await response.json();
      return agents;
    } catch (error) {
      console.error('Error searching agents:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const agentsService = new AgentsService();
export default agentsService;