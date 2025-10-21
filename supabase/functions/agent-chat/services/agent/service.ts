import { Agent } from '@openai/agents-core';
import { AgentFactory } from './factories/agent_factory.ts';
import { AgentRecord } from '../../types/agent.ts';

export class AgentService {
  private agentFactory: AgentFactory;

  constructor(
    supabaseUrl: string,
    anonKey: string,
    userJwt: string
  ) {
    this.agentFactory = new AgentFactory(supabaseUrl, anonKey, userJwt);
  }

  /**
   * Get all agents for a user, ensuring default agents exist
   */
  async getAllAgents(userId: string): Promise<AgentRecord[]> {
    return await this.agentFactory.getAllAgents(userId);
  }

  /**
   * Create an agent instance by ID
   */
  async createAgent(agentId: string, userId: string): Promise<Agent> {
    return await this.agentFactory.createAgent(agentId, userId);
  }

  /**
   * Get the underlying AgentFactory for advanced usage
   * This is primarily used by ChatKitService for complex agent operations
   */
  getAgentFactory(): AgentFactory {
    return this.agentFactory;
  }
}
