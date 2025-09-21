import { A2AClient as A2AClientSDK } from '@a2a-js/sdk/client';
import { MessageSendParams, A2AEvent, AgentCard, A2AMessage, Task, TaskStatusUpdateEvent, TextPart } from '@/types/a2a';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';

export class A2AClient {
  private client: A2AClientSDK;
  private agent?: Agent;

  constructor(agentCardUrl: string, agent?: Agent) {
    this.agent = agent;
    this.client = new A2AClientSDK(agentCardUrl);
  }

  static async fromCardUrl(agentCardUrl: string, agent?: Agent): Promise<A2AClient> {
    const client = new A2AClient(agentCardUrl, agent);
    return client;
  }

  createClientForAgent(agent: Agent): A2AClient {
    console.log('Creating A2A client for agent:', agent);
    console.log('Agent ID:', agent.id);
    
    if (!agent.id) {
      throw new Error('Agent ID is required to create A2A client');
    }
    
    // Create agent card URL for the specific agent - matching the working example format
    const agentCardUrl = `https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server/agents/${agent.id}/.well-known/agent-card.json`;
    console.log('Agent card URL:', agentCardUrl);
    
    return new A2AClient(agentCardUrl, agent);
  }

  async getAgentCard(): Promise<AgentCard> {
    try {
      return await this.client.getAgentCard();
    } catch (error) {
      console.error('Error getting agent card:', error);
      // Fallback to basic card if agent is available
      if (this.agent) {
        return {
          name: this.agent.name,
          description: this.agent.description || 'AI Agent',
          version: '1.0.0',
          capabilities: {
            streaming: true,
            pushNotifications: false,
            stateTransitionHistory: false
          },
          inputModes: ['text/plain'],
          outputModes: ['text/plain']
        };
      }
      throw error;
    }
  }

  async *sendMessageStream(params: MessageSendParams): AsyncGenerator<A2AEvent> {
    if (!this.agent) {
      throw new Error('No agent specified for this client');
    }

    console.log(`A2A Client: Sending message to ${this.agent.name}`);
    console.log('Message params:', params);

    try {
      // Use the A2A SDK's sendMessageStream method
      const stream = this.client.sendMessageStream(params);
      
      for await (const event of stream) {
        console.log('A2A Event received:', event);
        yield event as A2AEvent;
      }
    } catch (error) {
      console.error('Error in sendMessageStream:', error);
      throw error;
    }
  }

  // Convert our internal Message format to A2A Message format
  convertToA2AMessage(message: Partial<Message>): A2AMessage {
    return {
      messageId: message.id || crypto.randomUUID(),
      kind: 'message',
      role: message.type === 'user' ? 'user' : 'agent',
      parts: [{
        kind: 'text',
        text: message.content || ''
      }],
      contextId: crypto.randomUUID()
    };
  }

  // Convert A2A Message to our internal Message format
  convertFromA2AMessage(a2aMessage: A2AMessage, chatId: string): Partial<Message> {
    const textPart = a2aMessage.parts.find(p => p.kind === 'text') as TextPart;
    return {
      id: a2aMessage.messageId,
      chatId,
      content: textPart?.text || '',
      sender: a2aMessage.role === 'user' ? 'User' : 'Agent',
      timestamp: new Date().toISOString(),
      type: a2aMessage.role === 'user' ? 'user' : 'assistant',
      status: 'sent'
    };
  }
}

// Export a singleton instance - this will be replaced when creating agent-specific clients
export const a2aClient = new A2AClient('https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server');