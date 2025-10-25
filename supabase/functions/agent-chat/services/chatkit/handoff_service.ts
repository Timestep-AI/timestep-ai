import type { ThreadStreamEvent, ThreadMessageAddedEvent } from '../../types/chatkit.ts';
import { ThreadMessageStore } from '../../stores/thread_message_store.ts';
import { ChatKitItemFactory } from '../../utils/chatkit/factories/chatkit_item_factory.ts';
import { ChatKitEventFactory } from '../../utils/chatkit/factories/chatkit_event_factory.ts';
import { WidgetFactory } from '../../utils/chatkit/factories/widget_factory.ts';

export class HandoffService {
  private itemFactory: ChatKitItemFactory;
  private eventFactory: ChatKitEventFactory;

  constructor(
    private store: ThreadMessageStore,
    private processedHandoffs: Set<string>
  ) {
    this.itemFactory = new ChatKitItemFactory(store);
    this.eventFactory = new ChatKitEventFactory();
  }

  // Handoff Call Handler functionality
  async *handleHandoffCall(event: any, threadId: string): AsyncIterable<ThreadStreamEvent> {
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
    await this.store.saveThreadMessage(threadId, handoffToolCallItem);

    yield this.eventFactory.createItemAddedEvent(handoffItem);
  }

  // Handoff Output Handler functionality
  async *handleHandoffOutput(event: any, threadId: string): AsyncIterable<ThreadStreamEvent> {
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
