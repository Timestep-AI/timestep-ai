import type { ThreadStreamEvent, ThreadItemAddedEvent } from '../../../types/chatkit.ts';
import type { MemoryStore } from '../../../stores/memory_store.ts';
import { ItemFactory } from '../factories/item_factory.ts';
import { WidgetFactory } from '../factories/widget_factory.ts';

export class ToolCallOutputHandler {
  constructor(
    private store: MemoryStore<any>,
    private itemFactory: ItemFactory
  ) {}

  async *handle(event: any, threadId: string): AsyncIterable<ThreadStreamEvent> {
    const item = event.item;
    const tool = item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
    const toolName = tool?.name || 'tool';
    const output = tool?.output || '';

    // Save the tool call output to conversation history
    const toolCallOutputItem = this.itemFactory.createToolCallOutputItem(
      threadId,
      toolName,
      toolCallId,
      output
    );
    await this.store.saveThreadItem(threadId, toolCallOutputItem);

    // Create and emit tool result widget
    const toolResultWidget = WidgetFactory.createToolResultWidget(toolName, output);
    const toolResultItem = this.itemFactory.createWidgetItem(
      threadId,
      'tool_result',
      toolResultWidget
    );

    yield {
      type: 'thread.item.added',
      item: toolResultItem,
    } as ThreadItemAddedEvent;
  }
}
