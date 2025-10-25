import { ThreadService } from '../services/thread_service.ts';
import { Agent } from '@openai/agents-core';
import { RunnerFactory } from '../utils/runner_factory.ts';
import {
  type ThreadMetadata,
  type UserMessageItem,
  type ThreadStreamEvent,
} from '../types/chatkit.ts';

import { MessageProcessor } from '../utils/chatkit/processors/message_processor.ts';
import { ItemFactory } from '../utils/chatkit/factories/item_factory.ts';
import { streamAgentResponse } from '../utils/chatkit/streaming/agent_response_streamer.ts';

/**
 * Handles running agents and processing their responses
 * Responsible for executing agent workflows and streaming results
 */
export class AgentRunner {
  private messageProcessor: MessageProcessor;
  private itemFactory: ItemFactory;

  constructor(
    private store: ThreadService,
    private agent: Agent,
    private context: any
  ) {
    // Use the underlying ThreadStore for utility classes
    this.itemFactory = new ItemFactory(this.store.threadStore);
    this.messageProcessor = new MessageProcessor(this.store.threadStore, this.itemFactory);
  }

  /**
   * Execute agent response to a user message
   */
  async *respond(
    thread: ThreadMetadata,
    userMessage: UserMessageItem
  ): AsyncIterable<ThreadStreamEvent> {
    const messageText = await this.messageProcessor.extractMessageText(userMessage);
    if (!messageText) return;

    try {
      const messages = await this.messageProcessor.loadConversationHistory(thread.id);
      const agent = this.agent;
      const inputItems = this.messageProcessor.convertToAgentFormat(messages);

      const runner = await RunnerFactory.createRunner({
        threadId: thread.id,
        userId: this.context.userId,
        workflowName: `Agent workflow (${Date.now()})`,
      });

      const result = await runner.run(agent, inputItems, {
        context: { threadId: thread.id, userId: this.context.userId },
        stream: true,
      });

      await this.store.saveRunState(thread.id, (result as any).state);

      yield* streamAgentResponse(result as any, thread.id, this.store.threadStore);
    } catch (error) {
      console.error('[AgentRunner] Error:', error);
      throw error;
    }
  }
}
