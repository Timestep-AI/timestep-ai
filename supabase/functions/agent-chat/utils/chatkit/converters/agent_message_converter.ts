/**
 * Converts between ChatKit and OpenAI Agent message formats.
 * 
 * This converter is responsible for transforming messages between the two different
 * format systems:
 * 
 * - ChatKit Format: Rich format with complex content structures, attachments, etc.
 * - Agent Format: Simple format expected by OpenAI agents-core library
 * 
 * The converter handles bidirectional conversion to ensure compatibility between
 * the ChatKit frontend and OpenAI agent backend.
 */
export class AgentMessageConverter {
  /**
   * Converts ChatKit conversation messages into the format expected by OpenAI agents.
   * 
   * This method transforms the simplified role-based messages (from ChatKitMessageProcessor)
   * into the structured format that OpenAI agents require. The agent format includes:
   * 
   * - type: 'message' for all items
   * - role: 'user' or 'assistant'
   * - content: Array with properly typed content parts
   * - status: 'completed' for assistant messages
   * 
   * This is the final transformation step before sending messages to the agent,
   * ensuring compatibility with the OpenAI agents-core library.
   */
  convertToAgentFormat(messages: Array<{ role: 'user' | 'assistant'; content: string }>): any[] {
    return messages.map((msg) => {
      if (msg.role === 'user') {
        return {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: msg.content,
            },
          ],
        };
      } else {
        return {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: msg.content,
            },
          ],
        };
      }
    });
  }

  /**
   * Converts OpenAI Agent messages back to ChatKit format.
   * 
   * This method transforms agent responses back into ChatKit-compatible format.
   * It handles the conversion from agent format to ChatKit format for storage
   * and frontend display.
   */
  convertFromAgentFormat(agentMessages: any[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    return agentMessages.map((msg) => {
      let content = '';
      
      if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((part: any) => part.type === 'input_text' || part.type === 'output_text')
          .map((part: any) => part.text || '')
          .join(' ')
          .trim();
      } else if (typeof msg.content === 'string') {
        content = msg.content.trim();
      }

      return {
        role: msg.role,
        content,
      };
    });
  }

  /**
   * Converts a single agent message to ChatKit format.
   * 
   * This is a convenience method for converting individual agent messages
   * rather than arrays of messages.
   */
  convertSingleFromAgentFormat(agentMessage: any): { role: 'user' | 'assistant'; content: string } {
    const converted = this.convertFromAgentFormat([agentMessage]);
    return converted[0] || { role: 'assistant', content: '' };
  }

  /**
   * Converts a single ChatKit message to agent format.
   * 
   * This is a convenience method for converting individual ChatKit messages
   * rather than arrays of messages.
   */
  convertSingleToAgentFormat(chatkitMessage: { role: 'user' | 'assistant'; content: string }): any {
    const converted = this.convertToAgentFormat([chatkitMessage]);
    return converted[0] || { type: 'message', role: 'assistant', content: [] };
  }
}
