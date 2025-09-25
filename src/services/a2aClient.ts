import { A2AClient as A2AClientSDK } from '@a2a-js/sdk/client';
import { MessageSendParams, A2AEvent, AgentCard, A2AMessage, Task, TaskStatusUpdateEvent, TextPart, TaskArtifactUpdateEvent } from '@/types/a2a';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';

// Keep using the deployed Supabase URL since local dev points to it
const BASE_SERVER_URL = 'https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server';

export class A2AClient {
  private clientPromise: Promise<any>;
  private agent?: Agent;
  private authToken?: string;

  constructor(agentCardUrl: string, agent?: Agent, authToken?: string) {
    this.agent = agent;
    this.authToken = authToken;
    const authFetch = this.createAuthFetch(this.authToken);
    // Create SDK client from full agent-card URL
    this.clientPromise = (async () => {
      return await (A2AClientSDK as any).fromCardUrl(agentCardUrl, { fetchImpl: authFetch });
    })();
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
      const client = await this.clientPromise;
      return await client.getAgentCard();
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
      const client = await this.clientPromise;
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
      const stream = client.sendMessageStream(paramsWithAuth);

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
    console.log('convertFromA2AMessage called with:', {
      messageId: a2aMessage.messageId,
      role: a2aMessage.role,
      parts: a2aMessage.parts,
      partsDetail: a2aMessage.parts.map(p => ({ kind: p.kind, data: p.kind === 'data' ? p.data : p.kind === 'text' ? p.text : 'other' }))
    });

    // Extract text content just like the CLI does - get all text parts
    let textContent = a2aMessage.parts
      .filter(p => p.kind === 'text')
      .map(p => (p as TextPart).text)
      .join('\n');

    // If no text parts, check for data parts with deltas like the CLI does
    if (!textContent) {
      const dataParts = a2aMessage.parts.filter(p => p.kind === 'data');
      for (const part of dataParts) {
        if (part.data && typeof part.data === 'object') {
          const data = part.data as Record<string, unknown>;
          if (data.type === 'output_text_delta' && data.delta) {
            textContent += String(data.delta);
          } else if (data.text && typeof data.text === 'string') {
            textContent += data.text;
          }
        }
      }
    }

    console.log('Extracted text content:', textContent);

    // Detect tool calls in assistant messages (like CLI does)
    const isToolCall = a2aMessage.role === 'agent' &&
      textContent &&
      /^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*.*\s*\)\s*$/.test(textContent.trim());

    if (isToolCall) {
      console.log('Detected tool call pattern:', textContent);
    }

    return {
      id: a2aMessage.messageId,
      chatId,
      content: textContent || '',
      sender: a2aMessage.role === 'user' ? 'User' : 'Agent',
      timestamp: new Date().toISOString(),
      type: a2aMessage.role === 'user' ? 'user' : 'assistant',
      status: 'sent',
      isToolCall
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