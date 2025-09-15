import { Agent, CreateAgentRequest, UpdateAgentRequest } from '@/types/agent';

// Base URL for the server edge function
const SERVER_BASE_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

class AgentsService {
  constructor() {
    // Initialize with default agents
    this.createDefaults();
  }

  /**
   * Get all agents
   */
  async getAll(): Promise<Agent[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents`);
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }
      const agents = await response.json();
      return agents;
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
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

  /**
   * Create a new agent
   */
  async create(request: CreateAgentRequest): Promise<Agent> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create agent: ${response.statusText}`);
      }
      
      const agent = await response.json();
      return agent;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  /**
   * Update an existing agent
   */
  async update(id: string, request: UpdateAgentRequest): Promise<Agent | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to update agent: ${response.statusText}`);
      }
      
      const agent = await response.json();
      return agent;
    } catch (error) {
      console.error('Error updating agent:', error);
      throw error;
    }
  }

  /**
   * Delete an agent by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents/${id}`, {
        method: 'DELETE',
      });
      
      if (response.status === 404) {
        return false;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to delete agent: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }

  /**
   * Delete all agents
   */
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

  /**
   * Create default agents (clone from immutable defaults)
   */
  async createDefaults(): Promise<Agent[]> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/agents/defaults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create default agents: ${response.statusText}`);
      }
      
      const agents = await response.json();
      return agents;
    } catch (error) {
      console.error('Error creating default agents:', error);
      throw error;
    }
  }

  /**
   * Get count of agents
   */
  async getCount(): Promise<number> {
    try {
      const agents = await this.getAll();
      return agents.length;
    } catch (error) {
      console.error('Error getting agent count:', error);
      throw error;
    }
  }

  /**
   * Search agents by name or description
   */
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