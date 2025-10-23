import { ThreadsStore } from '../../../stores/threads_store.ts';
import { ItemFactory } from '../factories/item_factory.ts';

export class ToolCalledHandler {
  constructor(
    private store: ThreadsStore,
    private itemFactory: ItemFactory
  ) {}

  async *handle(event: any, threadId: string): AsyncIterable<any> {
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
