import type { MemoryStore } from '../../../stores/memory_store.ts';
import type { UserMessageItem } from '../../../types/chatkit.ts';
import { ItemFactory } from '../factories/item_factory.ts';

export class MessageProcessor {
  constructor(
    private store: MemoryStore<any>,
    private itemFactory: ItemFactory
  ) {}

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
