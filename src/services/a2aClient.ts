import { A2AClient as A2AClientSDK } from '@a2a-js/sdk/client';
import { MessageSendParams, A2AEvent, AgentCard, A2AMessage, Task, TaskStatusUpdateEvent, TextPart, TaskArtifactUpdateEvent } from '@/types/a2a';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';

// Keep using the deployed Supabase URL since local dev points to it
const BASE_SERVER_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

export class A2AClient {
  private client: A2AClientSDK;
  private agent?: Agent;
  private authToken?: string;

  constructor(agentCardUrl: string, agent?: Agent, authToken?: string) {
    this.agent = agent;
    this.authToken = authToken;
    const authFetch = this.createAuthFetch(this.authToken);
    this.client = new A2AClientSDK(agentCardUrl, { fetchImpl: authFetch });
  }

  static async fromCardUrl(agentCardUrl: string): Promise<A2AClient> {
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token;
    const client = new A2AClient(agentCardUrl, undefined, authToken);
    return client;
  }

  static async fromAgentId(agentId: string): Promise<A2AClient> {
    const agentCardUrl = `${BASE_SERVER_URL}/agents/${agentId}/.well-known/agent-card.json`;
    return A2AClient.fromCardUrl(agentCardUrl);
  }

  private createAuthFetch(initialToken?: string): typeof fetch {
    const self = this;
    return async function authFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      // Always get fresh session for better reliability
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? initialToken ?? self.authToken;

      const mergedInit: RequestInit = {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers as Record<string, string> | undefined),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };

      console.log('A2A Auth Fetch:', {
        url: url.toString(),
        hasToken: !!token,
        headers: mergedInit.headers
      });

      let res = await fetch(url, mergedInit);

      // Retry on auth failure with fresh token
      if ((res.status === 401 || res.status === 403)) {
        console.log('Auth failed, retrying with fresh token...');
        const retrySession = (await supabase.auth.getSession()).data.session;
        const retryToken = retrySession?.access_token;

        if (retryToken && retryToken !== token) {
          const retryInit: RequestInit = {
            ...init,
            headers: {
              'Content-Type': 'application/json',
              ...(init?.headers as Record<string, string> | undefined),
              Authorization: `Bearer ${retryToken}`,
            },
          };
          res = await fetch(url, retryInit);
        }
      }

      return res;
    };
  }

  async createClientForAgent(agent: Agent): Promise<A2AClient> {
    console.log('Creating A2A client for agent:', agent);
    console.log('Agent ID:', agent.id);

    if (!agent.id) {
      throw new Error('Agent ID is required to create A2A client');
    }

    // Use the static method for consistency
    return A2AClient.fromAgentId(agent.id);
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
    console.log(`A2A Client: Sending message`);
    console.log('Message params:', JSON.stringify(params, null, 2));

    try {
      // Get fresh auth token for each request
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token ?? this.authToken;

      const paramsWithAuth = {
        ...params,
        headers: {
          'Content-Type': 'application/json',
          ...params.headers,
          ...(authToken && { Authorization: `Bearer ${authToken}` })
        }
      };

      console.log('A2A Client: Sending with auth headers:', {
        hasToken: !!authToken,
        headers: paramsWithAuth.headers
      });

      // Use the A2A SDK's sendMessageStream method
      const stream = this.client.sendMessageStream(paramsWithAuth);

      for await (const event of stream) {
        console.log('A2A Event received:', event.kind, event);
        yield event as A2AEvent;
      }
    } catch (error) {
      console.error('Error in sendMessageStream:', error);
      throw error;
    }
  }

  // Convert our internal Message format to A2A Message format
  static convertToA2AMessage(message: Partial<Message>, contextId?: string): A2AMessage {
    const a2aMessage: A2AMessage = {
      messageId: message.id || crypto.randomUUID(),
      kind: 'message',
      role: message.type === 'user' ? 'user' : 'agent',
      parts: [{
        kind: 'text',
        text: message.content || ''
      }]
    };

    // Only add contextId if provided (to continue conversation)
    if (contextId) {
      a2aMessage.contextId = contextId;
    }

    return a2aMessage;
  }

  // Convert A2A Message to our internal Message format
  static convertFromA2AMessage(a2aMessage: A2AMessage, chatId: string): Partial<Message> {
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

  // Create a tool call response message (matching CLI example format)
  static createToolCallResponse(
    callId: string,
    artifactId: string,
    decision: 'approve' | 'reject',
    reason?: string,
    result?: string,
    contextId?: string,
    taskId?: string
  ): A2AMessage {
    const toolResponse: A2AMessage = {
      messageId: crypto.randomUUID(),
      kind: 'message',
      role: 'user',
      parts: [{
        kind: 'data',
        data: {
          toolCallResponse: {
            callId,
            artifactId,
            status: decision === 'approve' ? 'approved' : 'rejected',
            decision,
            reason,
            result: result || `Tool call ${decision}ed by user${reason ? `: ${reason}` : ''}`,
            executedAt: new Date().toISOString(),
          },
        },
      }]
    };

    // Add contextId and taskId only if provided
    if (contextId) {
      toolResponse.contextId = contextId;
    }
    if (taskId) {
      toolResponse.taskId = taskId;
    }

    return toolResponse;
  }
}

// No default instance exported to avoid unintended agent-card fetches