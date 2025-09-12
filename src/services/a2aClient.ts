import { MessageSendParams, A2AEvent, AgentCard, A2AMessage, Task, TaskStatusUpdateEvent, TextPart } from '@/types/a2a';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';

export class A2AClient {
  private serverUrl: string;
  private agent?: Agent;

  constructor(serverUrl: string, agent?: Agent) {
    this.serverUrl = serverUrl;
    this.agent = agent;
  }

  createClientForAgent(agent: Agent): A2AClient {
    // Create a new client instance for the specific agent
    // In a real implementation, this might use agent-specific endpoints or configuration
    const agentServerUrl = this.getAgentServerUrl(agent);
    return new A2AClient(agentServerUrl, agent);
  }

  private getAgentServerUrl(agent: Agent): string {
    // In a real implementation, this would return the agent's specific server URL
    // For now, we'll use the same base URL but could be extended to support per-agent endpoints
    return this.serverUrl;
  }

  async getAgentCard(): Promise<AgentCard> {
    // Stub implementation - in a real implementation this would fetch from the server
    const agentName = this.agent?.name || 'Demo Agent';
    return {
      name: agentName,
      description: this.agent?.description || 'A demonstration agent for testing A2A protocol',
      version: '1.0.0',
      url: this.serverUrl,
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: false
      },
      inputModes: ['text/plain'],
      outputModes: ['text/plain']
    };
  }

  async *sendMessageStream(params: MessageSendParams): AsyncGenerator<A2AEvent> {
    // Stub implementation - simulate streaming response
    const agentName = this.agent?.name || 'Demo Agent';
    console.log(`A2A Client: Sending message to ${agentName} via message/stream`, params);

    // Simulate task creation
    const taskId = crypto.randomUUID();
    const contextId = crypto.randomUUID();

    // Yield initial task object
    yield {
      kind: 'task',
      id: taskId,
      contextId,
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString()
      },
      artifacts: [],
      history: [params.message],
      metadata: {}
    } as Task;

    // Yield status update - working
    yield {
      kind: 'status-update',
      taskId,
      contextId,
      status: { 
        state: 'working',
        timestamp: new Date().toISOString()
      },
      final: false
    } as TaskStatusUpdateEvent;

    // Simulate some processing time
    await this.delay(1000);

    // Yield a response message
    const responseText = this.agent 
      ? `Hello! I'm ${this.agent.name}. I received your message: "${params.message.parts.find(p => p.kind === 'text')?.text}". This is a stub response from the A2A client.`
      : `I received your message: "${params.message.parts.find(p => p.kind === 'text')?.text}". This is a stub response from the A2A client.`;

    yield {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: 'agent',
      parts: [{
        kind: 'text',
        text: responseText
      }],
      taskId,
      contextId
    } as A2AMessage;

    // Yield final status - completed
    yield {
      kind: 'status-update',
      taskId,
      contextId,
      status: { 
        state: 'completed',
        timestamp: new Date().toISOString()
      },
      final: true
    } as TaskStatusUpdateEvent;
  }

  // Convert our internal Message format to A2A Message format
  convertToA2AMessage(message: Partial<Message>): A2AMessage {
    return {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: message.type === 'user' ? 'user' : 'agent',
      parts: [{
        kind: 'text',
        text: message.content || ''
      }]
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
      timestamp: new Date().toLocaleString(),
      type: a2aMessage.role === 'user' ? 'user' : 'assistant',
      status: 'sent'
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a singleton instance
export const a2aClient = new A2AClient('http://localhost:41241');