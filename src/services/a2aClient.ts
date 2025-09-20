import { MessageSendParams, A2AEvent, AgentCard, A2AMessage, Task, TaskStatusUpdateEvent, TextPart } from '@/types/a2a';
import { Message } from '@/types/message';
import { Agent } from '@/types/agent';
import { supabase } from '@/integrations/supabase/client';

export class A2AClient {
  private serverUrl: string;
  private agent?: Agent;

  constructor(serverUrl: string, agent?: Agent) {
    this.serverUrl = serverUrl;
    this.agent = agent;
  }

  createClientForAgent(agent: Agent): A2AClient {
    // Create a new client instance for the specific agent using the edge function
    const agentServerUrl = `https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server/agents/${agent.id}`;
    return new A2AClient(agentServerUrl, agent);
  }

  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
    };
  }

  async getAgentCard(): Promise<AgentCard> {
    if (!this.agent) {
      throw new Error('No agent specified for this client');
    }

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.serverUrl}/card`, { 
        headers 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get agent card: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting agent card:', error);
      // Fallback to basic card
      return {
        name: this.agent.name,
        description: this.agent.description || 'AI Agent',
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
  }

  async *sendMessageStream(params: MessageSendParams): AsyncGenerator<A2AEvent> {
    if (!this.agent) {
      throw new Error('No agent specified for this client');
    }

    console.log(`A2A Client: Sending message to ${this.agent.name} via ${this.serverUrl}`);
    console.log('Message params:', params);

    try {
      const headers = await this.getAuthHeaders();
      
      // Prepare the request body in the proper A2A format
      const requestBody = {
        message: {
          messageId: params.message.messageId || crypto.randomUUID(),
          kind: 'message',
          role: 'user',
          parts: params.message.parts,
          contextId: params.message.contextId
        },
        contextId: params.message.contextId
      };

      console.log('A2A Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.serverUrl}/message/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('A2A Response Error:', response.status, response.statusText, errorText);
        throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('A2A Stream completed');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            try {
              let event: any;
              
              // Handle Server-Sent Events format
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') {
                  console.log('A2A Stream done signal received');
                  continue;
                }
                event = JSON.parse(dataStr);
              } else {
                // Handle raw JSON
                event = JSON.parse(line);
              }
              
              console.log('A2A Event received:', event);
              yield event as A2AEvent;
            } catch (parseError) {
              console.warn('Failed to parse SSE line:', line, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
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
      timestamp: new Date().toLocaleString(),
      type: a2aMessage.role === 'user' ? 'user' : 'assistant',
      status: 'sent'
    };
  }
}

// Export a singleton instance with the edge function URL
export const a2aClient = new A2AClient('https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server');