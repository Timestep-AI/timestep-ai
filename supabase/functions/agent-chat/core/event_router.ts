import { ThreadStore } from '../stores/thread_store.ts';
import { Agent } from '@openai/agents-core';
import { type ThreadMetadata, type ThreadStreamEvent } from '../types/chatkit.ts';

import { ToolHandler } from '../utils/chatkit/handlers/tool_handler.ts';
import { ItemFactory } from '../utils/chatkit/factories/item_factory.ts';

/**
 * Routes events to appropriate handlers
 * Responsible for directing different types of events to their specific handlers
 */
export class EventRouter {
  private toolHandler: ToolHandler;
  private itemFactory: ItemFactory;

  constructor(
    private store: ThreadStore,
    private agent: Agent,
    private context: any
  ) {
    this.itemFactory = new ItemFactory(store);
    this.toolHandler = new ToolHandler(store, agent, context);
  }

  /**
   * Handle tool approval events
   */
  async *handleApproval(
    thread: ThreadMetadata,
    action: string,
    params: any
  ): AsyncIterable<ThreadStreamEvent> {
    yield* this.toolHandler.handleApproval(thread, action, params);
  }
}
