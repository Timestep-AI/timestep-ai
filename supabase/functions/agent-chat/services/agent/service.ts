import { Agent } from '@openai/agents-core';
import { AgentFactory } from './factories/agent_factory.ts';
import { AgentRecord } from '../../types/agent.ts';
import { AgentChatKitService } from '../agent_chatkit/service.ts';
import { MemoryStore } from '../../stores/memory_store.ts';

export class AgentService {
  private agentFactory: AgentFactory;
  private store: MemoryStore<any>;

  constructor(supabaseUrl: string, anonKey: string, userJwt: string, store: MemoryStore<any>) {
    this.agentFactory = new AgentFactory(supabaseUrl, anonKey, userJwt);
    this.store = store;
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
   * Process a ChatKit request by delegating to AgentChatKitService
   */
  async processChatKitRequest(
    agentId: string,
    userId: string,
    requestBody: string,
    context: any
  ): Promise<{ streaming: boolean; result: any }> {
    const agent = await this.createAgent(agentId, userId);
    const chatKitService = new AgentChatKitService(agent, context, this.store);
    return await chatKitService.processRequest(requestBody);
  }
}
