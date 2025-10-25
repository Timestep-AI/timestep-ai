import { ThreadMessageStore } from '../../../stores/thread_message_store.ts';
import { ThreadRunStateService } from '../../../services/thread_run_state_service.ts';
import { RunState } from '@openai/agents-core';
import { RunnerFactory } from '../../../utils/runner_factory.ts';
import { ChatKitEventFactory } from '../factories/chatkit_event_factory.ts';
import type { ThreadMetadata, ThreadStreamEvent } from '../../../types/chatkit.ts';
import { Agent } from '@openai/agents-core';

export class ToolHandler {
  private eventFactory: ChatKitEventFactory;

  constructor(
    private store: ThreadMessageStore,
    private runStateService: ThreadRunStateService,
    private agent: Agent,
    private context: any
  ) {
    this.eventFactory = new ChatKitEventFactory();
  }

  async *handleApproval(
    thread: ThreadMetadata,
    action: any,
    params?: any
  ): AsyncIterable<ThreadStreamEvent> {
    const toolCallId = this.extractToolCallId(action, params);

    if (action.type === 'approve_tool_call' || action.type === 'tool.approve') {
      return yield* this.approveToolCall(thread, toolCallId);
    }

    if (action.type === 'reject_tool_call' || action.type === 'tool.deny') {
      return yield* this.rejectToolCall(thread, toolCallId);
    }
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

  private async *approveToolCall(
    thread: ThreadMetadata,
    toolCallId: string
  ): AsyncIterable<ThreadStreamEvent> {
    const serializedState = await this.runStateService.loadRunState(thread.id);
    if (!serializedState) {
      yield this.eventFactory.createThreadUpdatedEvent(thread);
      return;
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

    const result = await this.runAgent(agent, runState, thread);
    await this.runStateService.clearRunState(thread.id);

    const { streamAgentResponse } = await import('../streaming/agent_response_streamer.ts');
    yield* streamAgentResponse(result, thread.id, this.store, this.runStateService);
  }

  private async *rejectToolCall(
    thread: ThreadMetadata,
    toolCallId: string
  ): AsyncIterable<ThreadStreamEvent> {
    const serializedState = await this.runStateService.loadRunState(thread.id);
    if (!serializedState) {
      yield this.eventFactory.createThreadUpdatedEvent(thread);
      return;
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

    const result = await this.runAgent(agent, runState, thread);
    await this.runStateService.clearRunState(thread.id);

    const { streamAgentResponse } = await import('../streaming/agent_response_streamer.ts');
    yield* streamAgentResponse(result, thread.id, this.store, this.runStateService);
  }

  private async runAgent(agent: any, runState: RunState, thread: ThreadMetadata) {
    const runner = await RunnerFactory.createRunner({
      threadId: thread.id,
      userId: this.context.userId,
    });
    return await runner.run(agent, runState, {
      context: { threadId: thread.id, userId: this.context.userId },
      stream: true,
    });
  }
}
