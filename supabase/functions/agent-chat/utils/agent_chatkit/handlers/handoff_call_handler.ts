import type { ThreadStreamEvent, ThreadItemAddedEvent } from '../../../types/chatkit.ts';
import { ThreadsStore } from '../../../stores/threads_store.ts';
import { ItemFactory } from '../factories/item_factory.ts';
import { WidgetFactory } from '../factories/widget_factory.ts';

export class HandoffCallHandler {
  constructor(
    private store: ThreadsStore,
    private itemFactory: ItemFactory,
    private processedHandoffs: Set<string>
  ) {}

  async *handle(event: any, threadId: string): AsyncIterable<ThreadStreamEvent> {
    const item = event.item;
    const handoff = item?.rawItem;
    const handoffCallId = handoff?.callId || handoff?.call_id || handoff?.id || 'unknown';
    const handoffName = handoff?.name || 'handoff';
    const argumentsText = handoff?.arguments || '';

    // Check if we've already processed this handoff to avoid duplicates
    const handoffKey = `handoff_${handoffName}_${threadId}`;
    if (this.processedHandoffs.has(handoffKey)) {
      return;
    }
    this.processedHandoffs.add(handoffKey);

    // Create and emit handoff widget
    const handoffWidget = WidgetFactory.createHandoffWidget(handoffName);
    const handoffItem = this.itemFactory.createWidgetItem(threadId, 'handoff', handoffWidget);

    // Save the handoff tool call to conversation history
    const handoffToolCallItem = this.itemFactory.createHandoffToolCallItem(
      threadId,
      handoffName,
      handoffCallId,
      argumentsText
    );
    await this.store.saveThreadItem(threadId, handoffToolCallItem);

    yield {
      type: 'thread.item.added',
      item: handoffItem,
    } as ThreadItemAddedEvent;
  }
}
