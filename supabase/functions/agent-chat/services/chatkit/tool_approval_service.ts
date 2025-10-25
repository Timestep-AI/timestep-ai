import type { ThreadStreamEvent, ThreadMessageAddedEvent } from '../../types/chatkit.ts';
import { ThreadMessageStore } from '../../stores/thread_message_store.ts';
import { ThreadRunStateService } from '../thread_run_state_service.ts';
import { ChatKitItemFactory } from '../../utils/chatkit/factories/chatkit_item_factory.ts';
import { WidgetFactory } from '../../utils/chatkit/factories/widget_factory.ts';

export class ToolApprovalHandler {
  private itemFactory: ChatKitItemFactory;

  constructor(
    private store: ThreadMessageStore,
    private runStateService: ThreadRunStateService
  ) {
    this.itemFactory = new ChatKitItemFactory(store);
  }

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
      await this.runStateService.saveRunState(threadId, serializedState);
    }

    // Create approval widget
    const approvalItemId = this.itemFactory.createWidgetItem(threadId, 'widget', {}).id;
    const widget = WidgetFactory.createToolApprovalWidget(
      toolName,
      argumentsText,
      toolCallId,
      approvalItemId
    );

    const widgetItem = this.itemFactory.createWidgetItem(threadId, 'widget', widget);
    widgetItem.id = approvalItemId; // Override with the specific ID

    yield {
      type: 'thread.item.added',
      item: widgetItem,
    } as ThreadMessageAddedEvent;

    yield {
      type: 'thread.item.done',
      item: widgetItem,
    } as any;

    // Pause further streaming until action arrives
    return;
  }
}
