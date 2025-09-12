import { Agent, CreateAgentRequest, UpdateAgentRequest } from '@/types/agent';

// Immutable default agents - these never change
const DEFAULT_AGENTS: Readonly<Agent[]> = [
  {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Personal Assistant',
    instructions: '# System context\nYou are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named `transfer_to_<agent_name>`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.\nYou are an AI agent acting as a personal assistant.',
    handoffIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666'],
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
  },
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Administrative Assistant',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'An administrative assistant that can manage administrative tasks on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Communications Coordinator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A communications coordinator that can manage communications on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Content Creator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A content creator that can create content on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Project Manager',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A project manager that can manage projects on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Research Assistant',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A research assistant that can research on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'handoff',
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Scheduling Coordinator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A scheduling coordinator that can schedule appointments on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
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