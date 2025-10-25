import { ThreadService } from '../services/thread_service.ts';
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
    private store: ThreadService,
    private agent: Agent,
    private context: any
  ) {
    // Use the underlying ThreadStore for utility classes
    this.itemFactory = new ItemFactory(this.store.threadStore);
    this.toolHandler = new ToolHandler(this.store.threadStore, agent, context);
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
