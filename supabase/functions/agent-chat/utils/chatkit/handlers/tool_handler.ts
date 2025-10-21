import { ThreadsStore } from '../../../stores/threads_store.ts';
import { Runner, RunState } from '@openai/agents-core';
import { OpenAIProvider } from '@openai/agents-openai';
import type {
  ThreadMetadata,
  ThreadStreamEvent,
  ThreadUpdatedEvent,
} from '../../../types/chatkit.ts';
import { Agent } from '@openai/agents-core';

export class ToolHandler {
  constructor(
    private store: ThreadsStore,
    private agent: Agent,
    private context: any
  ) {}

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
    let toolCallId = action?.toolCallId || action?.payload?.tool_call_id || action?.tool_call_id;

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
    const serializedState = await this.store.loadRunState(thread.id);
    if (!serializedState) {
      yield this.createThreadUpdatedEvent(thread);
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
    await this.store.clearRunState(thread.id);

    const { streamAgentResponse } = await import('../streaming/agent_response_streamer.ts');
    yield* streamAgentResponse(result, thread.id, this.store);
  }

  private async *rejectToolCall(
    thread: ThreadMetadata,
    toolCallId: string
  ): AsyncIterable<ThreadStreamEvent> {
    const serializedState = await this.store.loadRunState(thread.id);
    if (!serializedState) {
      yield this.createThreadUpdatedEvent(thread);
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
    await this.store.clearRunState(thread.id);

    const { streamAgentResponse } = await import('../streaming/agent_response_streamer.ts');
    yield* streamAgentResponse(result, thread.id, this.store);
  }

  private async runAgent(agent: any, runState: RunState, thread: ThreadMetadata) {
    const modelProvider = new OpenAIProvider({
      apiKey: Deno.env.get('OPENAI_API_KEY') || '',
    });

    const runConfig = {
      modelProvider,
      traceIncludeSensitiveData: true,
      tracingDisabled: false,
      groupId: thread.id,
      metadata: { user_id: this.context.userId },
    };

    const runner = new Runner(runConfig);
    return await runner.run(agent, runState, {
      context: { threadId: thread.id, userId: this.context.userId },
      stream: true,
    });
  }

  private createThreadUpdatedEvent(thread: ThreadMetadata): ThreadUpdatedEvent {
    return {
      type: 'thread.updated',
      thread: {
        id: thread.id,
        created_at:
          typeof thread.created_at === 'number'
            ? thread.created_at
            : Math.floor(new Date(thread.created_at as any).getTime() / 1000),
        status: { type: 'active' },
        metadata: thread.metadata || {},
        items: { data: [], has_more: false, after: null },
      },
    };
  }
}
