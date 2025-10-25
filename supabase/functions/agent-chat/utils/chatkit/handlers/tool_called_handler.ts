import { ThreadStore } from '../../../stores/thread_store.ts';
import { ItemFactory } from '../factories/item_factory.ts';

export class ToolCalledHandler {
  constructor(
    private store: ThreadStore,
    private itemFactory: ItemFactory
  ) {}

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
    await this.store.saveThreadItem(threadId, toolCallItem);
  }
}
