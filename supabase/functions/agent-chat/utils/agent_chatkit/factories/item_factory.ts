import { ThreadsStore } from '../../../stores/threads_store.ts';

export class ItemFactory {
  constructor(private store: ThreadsStore) {}

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
