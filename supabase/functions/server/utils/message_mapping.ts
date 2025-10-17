// Clean mapping between OpenAI message format (canonical) and ChatKit ThreadItem format
// This is the SINGLE SOURCE OF TRUTH for conversions

import type { ThreadItem, UserMessageItem, AssistantMessageItem } from 'npm:@openai/chatkit@^0.1.5';

/**
 * OpenAI Message Format (Canonical Storage)
 */
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string | any[];
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string; // For tool messages
  name?: string; // For tool messages
}

/**
 * Convert ChatKit ThreadItem to OpenAI Message Format
 * This is called when loading from database or processing user input
 */
export function chatKitToOpenAI(item: ThreadItem): OpenAIMessage | null {
  if (item.type === 'user_message') {
    const userItem = item as UserMessageItem;
    const content = Array.isArray(userItem.content) ? userItem.content : [];
    const text = content
      .filter((part: any) => part.type === 'input_text')
      .map((part: any) => part.text)
      .join(' ')
      .trim();
    
    if (!text) return null;
    
    return {
      role: 'user',
      content: text,
    };
  }
  
  if (item.type === 'assistant_message') {
    const assistantItem = item as AssistantMessageItem;
    const content = Array.isArray(assistantItem.content) ? assistantItem.content : [];
    const text = content
      .filter((part: any) => part.type === 'output_text')
      .map((part: any) => part.text)
      .join(' ')
      .trim();
    
    return {
      role: 'assistant',
      content: text,
    };
  }
  
  // Widget items represent assistant messages with tool_calls (pending approval)
  if (item.type === 'widget') {
    const widgetItem = item as any;
    const widget = widgetItem.widget;
    
    // Extract tool call information from the widget
    const toolCallId = widget?.confirm?.action?.toolCallId || widget?.cancel?.action?.toolCallId;
    
    if (toolCallId) {
      // This widget represents an assistant message with a tool_call
      // We need to reconstruct the tool call from the widget data
      const toolName = extractToolNameFromWidget(widget);
      const toolArgs = extractToolArgsFromWidget(widget);
      
      return {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: toolCallId,
          type: 'function',
          function: {
            name: toolName,
            arguments: toolArgs,
          },
        }],
      };
    }
  }
  
  // Client tool call items represent tool response messages
  if ((item as any).type === 'client_tool_call') {
    const toolItem = item as any;
    
    return {
      role: 'tool',
      tool_call_id: toolItem.call_id,
      name: toolItem.name,
      content: toolItem.output || '',
    };
  }
  
  return null;
}

/**
 * Convert OpenAI Message to ChatKit ThreadItem(s)
 * This is called when saving to database or streaming to client
 * 
 * Note: An assistant message with tool_calls becomes a widget item
 * Tool messages become client_tool_call items
 */
export function openAIToChatKit(
  message: OpenAIMessage,
  threadId: string,
  generateItemId: (type: string) => string
): ThreadItem[] {
  if (message.role === 'user') {
    return [{
      type: 'user_message' as const,
      id: generateItemId('user_message'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: [{
        type: 'input_text',
        text: message.content as string,
      }],
    }];
  }
  
  if (message.role === 'assistant') {
    // Assistant message with tool calls → becomes a widget item
    if (message.tool_calls && message.tool_calls.length > 0) {
      const widgets: ThreadItem[] = [];
      
      for (const toolCall of message.tool_calls) {
        const widget = createToolApprovalWidget(
          toolCall.function.name,
          toolCall.id,
          toolCall.function.arguments
        );
        
        widgets.push({
          type: 'widget' as const,
          id: generateItemId('widget'),
          thread_id: threadId,
          created_at: Math.floor(Date.now() / 1000),
          content: {},
          widget: widget,
        });
      }
      
      return widgets;
    }
    
    // Regular assistant message → assistant_message item
    return [{
      type: 'assistant_message' as const,
      id: generateItemId('assistant_message'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      content: [{
        type: 'output_text',
        text: message.content as string || '',
      }],
    }];
  }
  
  if (message.role === 'tool') {
    // Tool message → client_tool_call item
    return [{
      type: 'client_tool_call' as const,
      id: generateItemId('tool_call'),
      thread_id: threadId,
      created_at: Math.floor(Date.now() / 1000),
      name: message.name || 'unknown',
      call_id: message.tool_call_id || 'unknown',
      arguments: '', // We don't have the original arguments in the tool response
      output: message.content as string || '',
      status: 'completed',
      content: {},
    }];
  }
  
  return [];
}

/**
 * Create a tool approval widget for ChatKit
 */
function createToolApprovalWidget(toolName: string, toolCallId: string, argumentsJson: string) {
  let args: Record<string, any> = {};
  try {
    args = JSON.parse(argumentsJson);
  } catch (e) {
    console.error('[MessageMapping] Failed to parse tool arguments:', argumentsJson);
  }
  
  return {
    type: 'Card',
    size: 'sm',
    confirm: {
      label: 'Approve',
      action: {
        type: 'approve_tool_call',
        toolCallId: toolCallId,
      },
    },
    cancel: {
      label: 'Deny',
      action: {
        type: 'reject_tool_call',
        toolCallId: toolCallId,
      },
    },
    children: [
      {
        type: 'Row',
        align: 'center',
        gap: 3,
        children: [
          {
            type: 'Box',
            background: 'alpha-10',
            radius: 'sm',
            padding: 2,
            children: [
              {
                type: 'Icon',
                name: 'square-code',
                size: 'lg',
              },
            ],
          },
          {
            type: 'Col',
            gap: 0,
            children: [
              {
                type: 'Title',
                value: 'Tool approval required',
                size: 'sm',
              },
              {
                type: 'Caption',
                value: toolName,
                color: 'secondary',
              },
            ],
          },
        ],
      },
      {
        type: 'Divider',
        flush: true,
      },
      {
        type: 'Col',
        gap: 2,
        children: [
          {
            type: 'Caption',
            value: 'Arguments',
            color: 'secondary',
          },
          ...Object.entries(args).map(([key, value]) => ({
            type: 'Row',
            gap: 2,
            children: [
              {
                type: 'Badge',
                label: key,
              },
              {
                type: 'Text',
                value: String(value),
                size: 'sm',
              },
            ],
          })),
          {
            type: 'Text',
            value: `May send ${toolName} request to external service.`,
            size: 'xs',
            color: 'tertiary',
          },
        ],
      },
    ],
  };
}

/**
 * Extract tool name from widget (reverse engineering)
 */
function extractToolNameFromWidget(widget: any): string {
  // Look for the Caption with the tool name
  const row = widget.children?.[0];
  if (row?.type === 'Row') {
    const col = row.children?.[1];
    if (col?.type === 'Col') {
      const caption = col.children?.[1];
      if (caption?.type === 'Caption') {
        return caption.value || 'unknown';
      }
    }
  }
  return 'unknown';
}

/**
 * Extract tool arguments from widget (reverse engineering)
 */
function extractToolArgsFromWidget(widget: any): string {
  // Reconstruct arguments from the badge/text rows
  const argsSection = widget.children?.[2];
  if (argsSection?.type === 'Col') {
    const args: Record<string, any> = {};
    
    for (const child of argsSection.children || []) {
      if (child.type === 'Row' && child.children?.length === 2) {
        const badge = child.children[0];
        const text = child.children[1];
        
        if (badge?.type === 'Badge' && text?.type === 'Text') {
          args[badge.label] = text.value;
        }
      }
    }
    
    return JSON.stringify(args);
  }
  
  return '{}';
}

