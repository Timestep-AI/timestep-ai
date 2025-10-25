import { ThreadMessageStore } from '../../stores/thread_message_store.ts';
import { ChatKitItemFactory } from '../../utils/chatkit/factories/chatkit_item_factory.ts';

export class ToolCalledHandler {
  private itemFactory: ChatKitItemFactory;

  constructor(private store: ThreadMessageStore) {
    this.itemFactory = new ChatKitItemFactory(store);
  }

  async handle(event: any, threadId: string): Promise<void> {
    const item = event.item;
    const tool = item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
    const toolName = tool?.name || 'tool';
    const argumentsText = tool?.arguments || '';

    // Save the tool call to conversation history
    const toolCallItem = this.itemFactory.createToolCallItem(
      threadId,
      toolName,
      toolCallId,
      argumentsText
    );
    await this.store.saveThreadMessage(threadId, toolCallItem);
  }
}
