import type { ThreadStreamEvent, ThreadMessageAddedEvent } from '../../../types/chatkit.ts';
import { ThreadMessageStore } from '../../../stores/thread_message_store.ts';
import { ChatKitItemFactory } from '../factories/chatkit_item_factory.ts';
import { WidgetFactory } from '../factories/widget_factory.ts';

export class HandoffOutputHandler {
  private itemFactory: ChatKitItemFactory;

  constructor(
    private store: ThreadMessageStore,
    private processedHandoffs: Set<string>
  ) {
    this.itemFactory = new ChatKitItemFactory(store);
  }

  async *handle(event: any, threadId: string): AsyncIterable<ThreadStreamEvent> {
    const item = event.item;
    const handoff = item?.rawItem;
    const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id || 'unknown';
    const output = handoff?.output || '';

    // Check if we've already processed this handoff output to avoid duplicates
    const handoffOutputKey = `handoff_output_${threadId}`;
    if (this.processedHandoffs.has(handoffOutputKey)) {
      return;
    }
    this.processedHandoffs.add(handoffOutputKey);

    // Create and emit handoff result widget
    const handoffResultWidget = WidgetFactory.createHandoffResultWidget(output);
    const handoffResultItem = this.itemFactory.createWidgetItem(
      threadId,
      'handoff_result',
      handoffResultWidget
    );

    // Save the handoff result to conversation history
    const handoffResultToolItem = this.itemFactory.createHandoffResultToolItem(
      threadId,
      handoffCallId,
      output
    );
    await this.store.saveThreadMessage(threadId, handoffResultToolItem);

    yield {
      type: 'thread.item.added',
      item: handoffResultItem,
    } as ThreadMessageAddedEvent;
  }
}
