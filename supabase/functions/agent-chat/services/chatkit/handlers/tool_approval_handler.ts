import type { ThreadStreamEvent, ThreadItemAddedEvent } from '../../../types/chatkit.ts';
import type { MemoryStore } from '../../../stores/memory_store.ts';
import { ItemFactory } from '../factories/item_factory.ts';
import { WidgetFactory } from '../factories/widget_factory.ts';

export class ToolApprovalHandler {
  constructor(
    private store: MemoryStore<any>,
    private itemFactory: ItemFactory
  ) {}

  async *handle(event: any, threadId: string): AsyncIterable<ThreadStreamEvent> {
    const item = event.item;
    const tool = item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
    const toolName = tool?.name || 'tool';
    const argumentsText = tool?.arguments || '';

    // Save the run state so we can resume after approval/rejection
    const runState = (event as any).state;
    if (runState) {
      const serializedState = JSON.stringify(runState);
      await this.store.saveRunState(threadId, serializedState);
    }

    // Create approval widget
    const approvalItemId = this.itemFactory.createWidgetItem(threadId, 'widget', {}).id;
    const widget = WidgetFactory.createToolApprovalWidget(toolName, argumentsText, toolCallId, approvalItemId);

    // Store the toolCallId in the approval store
    const { markApproved } = await import('../../../stores/approval_store.ts');
    markApproved(threadId, toolCallId);

    const widgetItem = this.itemFactory.createWidgetItem(threadId, 'widget', widget);
    widgetItem.id = approvalItemId; // Override with the specific ID

    yield {
      type: 'thread.item.added',
      item: widgetItem,
    } as ThreadItemAddedEvent;

    yield {
      type: 'thread.item.done',
      item: widgetItem,
    } as any;

    // Pause further streaming until action arrives
    return;
  }
}
