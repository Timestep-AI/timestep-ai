import { ThreadMessageStore } from '../../../stores/thread_message_store.ts';

/**
 * Creates ChatKit items for database storage.
 *
 * This factory is responsible for creating all types of ChatKit items that get
 * stored in the database. These are persistent data objects, not streaming events.
 *
 * ChatKit items include:
 * - Tool call items (requests and results)
 * - Handoff items (requests and results)
 * - Widget items
 * - Assistant message items
 */
export class ChatKitItemFactory {
  constructor(private store: ThreadMessageStore) {}

  /**
   * Creates a tool call output item for database storage.
   * Represents the result of a tool call execution.
   */
  createToolCallOutputItem(threadId: string, toolName: string, toolCallId: string, output: any) {
    return {
      type: 'client_tool_call' as const,
      id: this.store.generateItemId('tool_call_output'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      name: toolName,
      call_id: toolCallId,
      arguments: '',
      output: output,
      status: 'completed',
      content: {},
    };
  }

  /**
   * Creates a tool call item for database storage.
   * Represents a tool call request.
   */
  createToolCallItem(
    threadId: string,
    toolName: string,
    toolCallId: string,
    argumentsText: string
  ) {
    return {
      type: 'client_tool_call' as const,
      id: this.store.generateItemId('tool_call'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      name: toolName,
      call_id: toolCallId,
      arguments: argumentsText,
      output: '',
      status: 'completed',
      content: {},
    };
  }

  /**
   * Creates a handoff tool call item for database storage.
   * Represents a handoff request between agents.
   */
  createHandoffToolCallItem(
    threadId: string,
    handoffName: string,
    handoffCallId: string,
    argumentsText: string
  ) {
    return {
      type: 'assistant_message' as const,
      id: this.store.generateItemId('assistant_message'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: [],
      tool_calls: [
        {
          id: handoffCallId,
          type: 'function' as const,
          function: {
            name: handoffName,
            arguments: argumentsText,
          },
        },
      ],
    };
  }

  /**
   * Creates a handoff result tool item for database storage.
   * Represents the result of a handoff operation.
   */
  createHandoffResultToolItem(threadId: string, handoffCallId: string, output: any) {
    return {
      type: 'tool_message' as const,
      id: this.store.generateItemId('tool_message'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: output,
      tool_call_id: handoffCallId,
    };
  }

  /**
   * Creates a widget item for database storage.
   * Represents a UI widget in the conversation.
   */
  createWidgetItem(threadId: string, widgetType: string, widget: any) {
    return {
      type: 'widget' as const,
      id: this.store.generateItemId('widget'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: {},
      widget: widget,
    };
  }

  /**
   * Creates an assistant message item for database storage.
   * Represents an assistant's response message.
   */
  createAssistantMessageItem(threadId: string, itemId: string, createdAt: number) {
    return {
      type: 'assistant_message',
      id: itemId,
      thread_id: threadId,
      content: [
        {
          annotations: [],
          text: '',
          type: 'output_text',
        },
      ],
      created_at: createdAt,
    };
  }
}
