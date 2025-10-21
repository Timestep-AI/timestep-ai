import { Agent } from '@openai/agents-core';
import { AgentFactory } from './factories/agent_factory.ts';
import { AgentRecord } from '../../types/agent.ts';
import { AgentChatKitService } from '../agent_chatkit/service.ts';
import { MemoryStore } from '../../stores/memory_store.ts';

export class AgentService {
  private agentFactory: AgentFactory;

  constructor(supabaseUrl: string, anonKey: string, userJwt: string) {
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
   * Process a ChatKit request by delegating to AgentChatKitService
   */
  async processChatKitRequest(
    _agentId: string,
    _userId: string,
    requestBody: string,
    store: MemoryStore<any>,
    context: any
  ): Promise<{ streaming: boolean; result: any }> {
    const chatKitService = new AgentChatKitService(store, this.agentFactory, context);
    return await chatKitService.processRequest(requestBody);
  }

  /**
   * Get the underlying AgentFactory for advanced usage
   * This is primarily used by AgentChatKitService for complex agent operations
   */
  getAgentFactory(): AgentFactory {
    return this.agentFactory;
  }
}
