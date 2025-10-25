import { ThreadService } from '../services/thread_service.ts';
import { Agent } from '@openai/agents-core';
import {
  isStreamingReq,
  type ChatKitRequest,
  type ThreadStreamEvent,
} from '../types/chatkit.ts';

import { AgentRunner } from './agent_runner.ts';

/**
 * Main orchestrator that coordinates between different services
 * Acts as the primary entry point for ChatKit requests
 */
export class AgentOrchestrator {
  private agentRunner: AgentRunner;

  constructor(
    private agent: Agent,
    private context: any,
    private store: ThreadService
  ) {
    this.agentRunner = new AgentRunner(store, agent, context);
  }

  /**
   * Main entry point for processing ChatKit requests
   */
  async processRequest(
    request: string | ArrayBuffer | Uint8Array
  ): Promise<{ streaming: boolean; result: AsyncIterable<Uint8Array> | object }> {
    const requestStr = typeof request === 'string' ? request : new TextDecoder().decode(request);
    const parsedRequest: ChatKitRequest = JSON.parse(requestStr);

    if (isStreamingReq(parsedRequest)) {
      return {
        streaming: true,
        result: this.agentRunner.encodeStream(this.processStreamingRequest(parsedRequest)),
      };
    } else {
      return { streaming: false, result: await this.processNonStreamingRequest(parsedRequest) };
    }
  }

  /**
   * Process streaming requests by delegating to AgentRunner
   */
  private async *processStreamingRequest(
    request: ChatKitRequest
  ): AsyncIterable<ThreadStreamEvent> {
    yield* this.agentRunner.processStreamingRequest(request);
  }

  /**
   * Process non-streaming requests
   */
  private async processNonStreamingRequest(request: ChatKitRequest): Promise<object> {
    switch (request.type) {
      case 'threads.get_by_id':
        return await this.store.loadFullThread(request.params!.thread_id!);

      case 'threads.list': {
        const params = request.params || {};
        const threads = await this.store.loadThreads(
          params.limit || 20,
          params.after || null,
          params.order || 'desc'
        );
        return {
          data: await Promise.all(threads.data.map((t) => this.store.loadFullThread(t.id))),
          has_more: threads.has_more,
          after: threads.after,
        };
      }

      case 'items.list': {
        const params = request.params!;
        return await this.store.loadThreadItems(
          params.thread_id!,
          params.after || null,
          params.limit || 20,
          params.order || 'asc'
        );
      }

      case 'threads.update': {
        const thread = await this.store.loadThread(request.params!.thread_id!);
        thread.title = request.params!.title;
        await this.store.saveThread(thread);
        return await this.store.loadFullThread(request.params!.thread_id!);
      }

      case 'threads.delete':
        await this.store.deleteThread(request.params!.thread_id!);
        return {};

      case 'threads.retry_after_item':
        return {};

      default:
        throw new Error(`Unknown request type: ${(request as any).type}`);
    }
  }

}
