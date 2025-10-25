import type { ThreadStreamEvent, ThreadItemAddedEvent } from '../../../types/chatkit.ts';
import { ThreadMessageStore } from '../../../stores/thread_message_store.ts';
import { ChatKitItemFactory } from '../factories/chatkit_item_factory.ts';
import { ChatKitEventFactory } from '../factories/chatkit_event_factory.ts';
import { WidgetFactory } from '../factories/widget_factory.ts';

export class ToolCallOutputHandler {
  private itemFactory: ChatKitItemFactory;
  private eventFactory: ChatKitEventFactory;

  constructor(
    private store: ThreadMessageStore
  ) {
    this.itemFactory = new ChatKitItemFactory(store);
    this.eventFactory = new ChatKitEventFactory();
  }

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

    yield this.eventFactory.createItemAddedEvent(toolResultItem);
  }
}
