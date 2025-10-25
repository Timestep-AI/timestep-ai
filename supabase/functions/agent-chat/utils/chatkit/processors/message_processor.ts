import { ThreadStore } from '../../../stores/thread_store.ts';
import type { UserMessageItem } from '../../../types/chatkit.ts';
import { ItemFactory } from '../factories/item_factory.ts';

/**
 * Handles message processing and data transformation for ChatKit operations.
 *
 * This class is responsible for:
 * - Converting between different message formats (ChatKit ↔ Agent format)
 * - Extracting text content from complex message structures
 * - Building properly formatted user message items
 * - Loading and formatting conversation history for agents
 *
 * The MessageProcessor bridges the gap between ChatKit's rich message format
 * (which supports attachments, quoted text, inference options) and the simpler
 * format expected by OpenAI agents (role + content).
 */
export class MessageProcessor {
  constructor(
    private store: ThreadStore,
    private itemFactory: ItemFactory
  ) {}

  /**
   * Extracts plain text content from a user message item.
   *
   * ChatKit messages can have complex content structures:
   * - Simple string content
   * - Array of content parts with different types
   *
   * This method normalizes all formats into a single plain text string.
   *
   * @param item - The user message item to extract text from
   * @returns The extracted plain text content, trimmed of whitespace
   */
  async extractMessageText(item: UserMessageItem): Promise<string> {
    if (typeof item.content === 'string') {
      return item.content.trim();
    } else if (Array.isArray(item.content)) {
      return item.content
        .filter((part) => part.type === 'input_text')
        .map((part) => (part as any).text)
        .join(' ')
        .trim();
    }
    return '';
  }

  /**
   * Loads and formats conversation history for agent consumption.
   *
   * This method retrieves all thread items from the database and converts them
   * into a simplified format that agents can understand. It handles three types
   * of thread items:
   *
   * - user_message: Extracts text using extractMessageText()
   * - assistant_message: Extracts text from output_text content parts
   * - client_tool_call: Formats as a descriptive text string
   *
   * The result is a chronological array of role-based messages that agents
   * can use to understand the conversation context.
   *
   * @param threadId - The ID of the thread to load history from
   * @returns Array of messages with role and content for agent consumption
   */
  async loadConversationHistory(
    threadId: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const threadItems = await this.store.loadThreadItems(threadId, null, 100, 'asc');
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const threadItem of threadItems.data) {
      if ((threadItem as any).type === 'user_message') {
        const text = await this.extractMessageText(threadItem as UserMessageItem);
        if (text) {
          messages.push({ role: 'user', content: text });
        }
      } else if ((threadItem as any).type === 'assistant_message') {
        const assistantItem = threadItem as any;
        let text = '';

        if (typeof assistantItem.content === 'string') {
          text = assistantItem.content.trim();
        } else if (Array.isArray(assistantItem.content)) {
          text = assistantItem.content
            .filter((part: any) => part.type === 'output_text')
            .map((part: any) => part.text)
            .join(' ')
            .trim();
        }

        if (text) {
          messages.push({ role: 'assistant', content: text });
        }
      } else if ((threadItem as any).type === 'client_tool_call') {
        const toolCallItem = threadItem as any;
        const toolCallText = `[Tool call: ${toolCallItem.name}(${toolCallItem.arguments}) -> ${toolCallItem.output || 'pending'}]`;
        messages.push({ role: 'assistant', content: toolCallText });
      }
    }

    return messages;
  }

  /**
   * Builds a properly formatted UserMessageItem from raw input data.
   *
   * This method takes raw input from ChatKit requests and creates a standardized
   * UserMessageItem that can be stored in the database and processed by agents.
   * It handles:
   *
   * - Content normalization (ensures content is always an array)
   * - ID generation using the thread store
   * - Timestamp creation
   * - Optional fields (attachments, quoted_text, inference_options)
   *
   * The method ensures that even malformed input results in a valid UserMessageItem
   * by providing default values when necessary.
   *
   * @param input - Raw input data from ChatKit request
   * @param thread - Thread metadata containing thread ID
   * @returns A properly formatted UserMessageItem ready for storage
   */
  buildUserMessageItem(input: any, thread: any): UserMessageItem {
    let content = Array.isArray(input.content) ? input.content : [input.content as any];
    if (
      !content ||
      content.length === 0 ||
      !content[0] ||
      typeof (content[0] as any).type !== 'string'
    ) {
      content = [{ type: 'input_text', text: '' } as any];
    }

    const userMessage: UserMessageItem = {
      type: 'user_message',
      id: this.store.generateItemId('message'),
      content,
      thread_id: thread.id,
      created_at: Math.floor(Date.now() / 1000),
      attachments: input.attachments || [],
    };

    if (input.quoted_text) {
      userMessage.quoted_text = input.quoted_text;
    }
    if (input.inference_options && Object.keys(input.inference_options).length > 0) {
      userMessage.inference_options = input.inference_options;
    }

    return userMessage;
  }

  /**
   * Converts simplified conversation messages into the format expected by OpenAI agents.
   *
   * This method transforms the simplified role-based messages (from loadConversationHistory)
   * into the structured format that OpenAI agents require. The agent format includes:
   *
   * - type: 'message' for all items
   * - role: 'user' or 'assistant'
   * - content: Array with properly typed content parts
   * - status: 'completed' for assistant messages
   *
   * This is the final transformation step before sending messages to the agent,
   * ensuring compatibility with the OpenAI agents-core library.
   *
   * @param messages - Array of simplified role-based messages
   * @returns Array of messages in OpenAI agent format
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
}
