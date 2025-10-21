import type { ThreadStreamEvent, ThreadItemAddedEvent } from '../../../types/chatkit.ts';
import type { MemoryStore } from '../../../stores/memory_store.ts';
import { ItemFactory } from '../factories/item_factory.ts';
import { WidgetFactory } from '../factories/widget_factory.ts';

export class HandoffOutputHandler {
  constructor(
    private store: MemoryStore<any>,
    private itemFactory: ItemFactory,
    private processedHandoffs: Set<string>
  ) {}

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
    await this.store.saveThreadItem(threadId, handoffResultToolItem);

    yield {
      type: 'thread.item.added',
      item: handoffResultItem,
    } as ThreadItemAddedEvent;
  }
}
