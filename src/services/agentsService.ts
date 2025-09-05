import { Agent, CreateAgentRequest, UpdateAgentRequest } from '@/types/agent';

// Immutable default agents - these never change
const DEFAULT_AGENTS: Readonly<Agent[]> = [
  {
    id: 'default-1',
    name: 'Personal Assistant',
    description: 'A versatile AI assistant for personal productivity and task management.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
  },
  {
    id: 'default-2',
    name: 'Administrative Assistant',
    description: 'Handles administrative tasks and office management duties.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: 'default-3',
    name: 'Communications Coordinator',
    description: 'Manages internal and external communications across teams.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
    model: 'meta/llama-3.2-11b-vision-instruct',
  },
  {
    id: 'default-4',
    name: 'Project Coordinator',
    description: 'Oversees project timelines, resources, and team coordination.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: 'default-5',
    name: 'Research Specialist',
    description: 'Conducts thorough research and analysis on various topics.',
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: 'default-6',
    name: 'Scheduling Coordinator',
    description: 'Manages calendars, appointments, and scheduling conflicts.',
    createdAt: '8/31/2025, 3:06:27 PM',
    status: 'handoff',
  },
] as const;

class AgentsService {
  private agents: Agent[] = [];
  private nextId = 1000; // Start custom IDs from 1000 to avoid conflicts

  constructor() {
    // Initialize with default agents
    this.createDefaults();
  }

  /**
   * Get all agents
   */
  async getAll(): Promise<Agent[]> {
    // Simulate API delay
    await this.delay(100);
    return [...this.agents]; // Return a copy
  }

  /**
   * Get agent by ID
   */
  async getById(id: string): Promise<Agent | null> {
    await this.delay(50);
    const agent = this.agents.find(a => a.id === id);
    return agent ? { ...agent } : null; // Return a copy
  }

  /**
   * Create a new agent
   */
  async create(request: CreateAgentRequest): Promise<Agent> {
    await this.delay(200);
    
    const newAgent: Agent = {
      id: `agent-${this.nextId++}`,
      name: request.name,
      description: request.description,
      model: request.model,
      status: request.status || 'active',
      createdAt: new Date().toLocaleString(),
    };

    this.agents.push(newAgent);
    return { ...newAgent }; // Return a copy
  }

  /**
   * Update an existing agent
   */
  async update(id: string, request: UpdateAgentRequest): Promise<Agent | null> {
    await this.delay(200);
    
    const index = this.agents.findIndex(a => a.id === id);
    if (index === -1) return null;

    const updatedAgent: Agent = {
      ...this.agents[index],
      ...request,
    };

    this.agents[index] = updatedAgent;
    return { ...updatedAgent }; // Return a copy
  }

  /**
   * Delete an agent by ID
   */
  async delete(id: string): Promise<boolean> {
    await this.delay(150);
    
    const index = this.agents.findIndex(a => a.id === id);
    if (index === -1) return false;

    this.agents.splice(index, 1);
    return true;
  }

  /**
   * Delete all agents
   */
  async deleteAll(): Promise<void> {
    await this.delay(100);
    this.agents = [];
  }

  /**
   * Create default agents (clone from immutable defaults)
   */
  async createDefaults(): Promise<Agent[]> {
    await this.delay(300);
    
    // Clone default agents with new IDs to avoid conflicts
    const clonedDefaults: Agent[] = DEFAULT_AGENTS.map((defaultAgent, index) => ({
      ...defaultAgent,
      id: `cloned-${Date.now()}-${index}`, // Generate unique IDs
      createdAt: new Date().toLocaleString(), // Update creation time
    }));

    this.agents = [...clonedDefaults];
    return [...this.agents]; // Return a copy
  }

  /**
   * Get count of agents
   */
  async getCount(): Promise<number> {
    await this.delay(50);
    return this.agents.length;
  }

  /**
   * Search agents by name or description
   */
  async search(query: string): Promise<Agent[]> {
    await this.delay(100);
    
    if (!query.trim()) return [...this.agents];
    
    const lowercaseQuery = query.toLowerCase();
    const filtered = this.agents.filter(agent => 
      agent.name.toLowerCase().includes(lowercaseQuery) ||
      agent.description?.toLowerCase().includes(lowercaseQuery)
    );
    
    return filtered.map(agent => ({ ...agent })); // Return copies
  }

  /**
   * Simulate API delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const agentsService = new AgentsService();
export default agentsService;