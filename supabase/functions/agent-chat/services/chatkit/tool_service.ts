import { ThreadMessageStore } from '../../stores/thread_message_store.ts';
import { ThreadRunStateService } from '../thread_run_state_service.ts';
import { RunState } from '@openai/agents-core';
import { ChatKitEventFactory } from '../../utils/chatkit/factories/chatkit_event_factory.ts';
import { ChatKitItemFactory } from '../../utils/chatkit/factories/chatkit_item_factory.ts';
import { WidgetFactory } from '../../utils/chatkit/factories/widget_factory.ts';
import type { ThreadMetadata, ThreadStreamEvent, ThreadMessageAddedEvent } from '../../types/chatkit.ts';
import { Agent } from '@openai/agents-core';

export class ToolService {
  private eventFactory: ChatKitEventFactory;
  private itemFactory: ChatKitItemFactory;

  constructor(
    private store: ThreadMessageStore,
    private runStateService: ThreadRunStateService,
    private agent: Agent,
    private context: any
  ) {
    this.eventFactory = new ChatKitEventFactory();
    this.itemFactory = new ChatKitItemFactory(store);
  }

  async handleApproval(
    thread: ThreadMetadata,
    action: any,
    params?: any
  ): Promise<{ runState: any; shouldExecute: boolean }> {
    const toolCallId = this.extractToolCallId(action, params);

    if (action.type === 'approve_tool_call' || action.type === 'tool.approve') {
      return await this.approveToolCall(thread, toolCallId);
    }

    if (action.type === 'reject_tool_call' || action.type === 'tool.deny') {
      return await this.rejectToolCall(thread, toolCallId);
    }

    return { runState: null, shouldExecute: false };
  }

  private extractToolCallId(action: any, params?: any): string {
    const toolCallId = action?.toolCallId || action?.payload?.tool_call_id || action?.tool_call_id;

    if (!toolCallId) {
      const itemId = action?.item_id || params?.item_id;
      if (itemId) {
        // In a real implementation, you'd load from database
        // For now, we'll assume it's passed in the action
      }
    }

    if (!toolCallId) {
      console.warn('[ToolHandler] No toolCallId found');
      throw new Error('No toolCallId found in action');
    }

    return toolCallId;
  }

  private async approveToolCall(
    thread: ThreadMetadata,
    toolCallId: string
  ): Promise<{ runState: any; shouldExecute: boolean }> {
    const serializedState = await this.runStateService.loadRunState(thread.id);
    if (!serializedState) {
      return { runState: null, shouldExecute: false };
    }

    const agent = this.agent;
    const runState = await RunState.fromString(agent, serializedState);

    // Approve the specific tool call
    const interruptions = runState.getInterruptions();
    for (const approvalItem of interruptions) {
      const itemToolCallId =
        (approvalItem.rawItem as any)?.callId ||
        (approvalItem.rawItem as any)?.call_id ||
        (approvalItem.rawItem as any)?.id;
      if (itemToolCallId === toolCallId) {
        runState.approve(approvalItem, { alwaysApprove: false });
      }
    }

    return { runState, shouldExecute: true };
  }

  private async rejectToolCall(
    thread: ThreadMetadata,
    toolCallId: string
  ): Promise<{ runState: any; shouldExecute: boolean }> {
    const serializedState = await this.runStateService.loadRunState(thread.id);
    if (!serializedState) {
      return { runState: null, shouldExecute: false };
    }

    const agent = this.agent;
    const runState = await RunState.fromString(agent, serializedState);

    // Reject the specific tool call
    const interruptions = runState.getInterruptions();
    for (const approvalItem of interruptions) {
      const itemToolCallId =
        (approvalItem.rawItem as any)?.callId ||
        (approvalItem.rawItem as any)?.call_id ||
        (approvalItem.rawItem as any)?.id;
      if (itemToolCallId === toolCallId) {
        runState.reject(approvalItem, { alwaysReject: false });
      }
    }

    return { runState, shouldExecute: true };
  }

  // Tool Called Handler functionality
  async handleToolCalled(event: any, threadId: string): Promise<void> {
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
    await this.store.saveThreadMessage(threadId, toolCallItem);
  }

  // Tool Approval Handler functionality
  async *handleToolApproval(event: any, threadId: string, runState?: any): AsyncIterable<ThreadStreamEvent> {
    const item = event.item;
    const tool = item?.rawItem;
    const toolCallId = tool?.callId || tool?.call_id || tool?.id || 'unknown';
    const toolName = tool?.name || 'tool';
    const argumentsText = tool?.arguments || '';

    // Save the run state so we can resume after approval/rejection
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

  // Tool Call Output Handler functionality
  async *handleToolCallOutput(event: any, threadId: string): AsyncIterable<ThreadStreamEvent> {
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
    await this.store.saveThreadMessage(threadId, toolCallOutputItem);

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
