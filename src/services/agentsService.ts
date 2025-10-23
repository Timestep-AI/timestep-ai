import { CreateAgentRequest, UpdateAgentRequest } from '@/types/agent';
import type { AgentRecord } from '../../supabase/functions/agent-chat/stores/agents_store';
import { supabase } from '@/integrations/supabase/client';

// Use environment-based URL for server functions
const getServerBaseUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  return `${supabaseUrl}/functions/v1/agent-chat`;
};

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  };
};

class AgentsService {
  async getAll(): Promise<AgentRecord[]> {
    try {
      console.log('AgentsService: Fetching from', `${getServerBaseUrl()}/agents`);
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/agents`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }
      const apiAgents = await response.json();
      console.log('AgentsService: Raw API response:', apiAgents);

      // If empty array, return empty array
      if (!Array.isArray(apiAgents) || apiAgents.length === 0) {
        return [];
      }

      // Map server response to AgentRecord interface
      const agents: AgentRecord[] = apiAgents.map((apiAgent: any) => ({
        id: apiAgent.id,
        user_id: apiAgent.user_id,
        name: apiAgent.name,
        instructions: apiAgent.instructions || '',
        tool_ids: apiAgent.tool_ids || [],
        handoff_ids: apiAgent.handoff_ids || [],
        model: apiAgent.model,
        model_settings: apiAgent.model_settings || { temperature: 0.0, toolChoice: 'auto' },
        created_at: apiAgent.created_at || new Date().toISOString(),
        updated_at: apiAgent.updated_at || new Date().toISOString(),
      }));

      return agents;
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<AgentRecord | null> {
    try {
      console.log('AgentsService: Fetching agent by ID:', id);

      // Since the server doesn't have a /agents/{id} endpoint,
      // we'll fetch all agents and find the one with matching ID
      const allAgents = await this.getAll();
      const agent = allAgents.find((a) => a.id === id);

      if (agent) {
        console.log('AgentsService: Found agent:', agent);
        return agent;
      } else {
        console.log('AgentsService: Agent not found:', id);
        return null;
      }
    } catch (error) {
      console.error('Error fetching agent:', error);
      throw error;
    }
  }

  async create(request: CreateAgentRequest): Promise<AgentRecord> {
    // Note: Server doesn't support agent creation yet
    throw new Error('Agent creation not implemented in server');
  }

  async update(id: string, request: UpdateAgentRequest): Promise<AgentRecord | null> {
    // Note: Server doesn't support agent updates yet
    throw new Error('Agent update not implemented in server');
  }

  async delete(id: string): Promise<boolean> {
    // Note: Server doesn't support agent deletion yet
    throw new Error('Agent deletion not implemented in server');
  }

  async deleteAll(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${getServerBaseUrl()}/agents`, {
        method: 'DELETE',
        headers,
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

  async search(query: string): Promise<AgentRecord[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${getServerBaseUrl()}/agents/search?q=${encodeURIComponent(query)}`,
        { headers }
      );

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
