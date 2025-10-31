import type { ThreadStreamEvent, ThreadMetadata, UserMessageItem } from './types.ts';
import type { Store } from './store.ts';
import type { TContext } from '../stores.ts';

export class AgentContext {
  constructor(
    public thread: ThreadMetadata,
    public store: Store<TContext>,
    public request_context: TContext,
  ) {}
}

// Convert a ChatKit user message item to a minimal Agents input format
export async function simple_to_agent_input(input: UserMessageItem | null): Promise<any[]> {
  if (!input) return [];
  const parts = Array.isArray(input.content) ? input.content : [input.content];
  const textParts = parts
    .filter((p: any) => p && typeof p.type === 'string' && (p.type === 'input_text' || p.type === 'text'))
    .map((p: any) => ({ type: 'input_text', text: p.text ?? '' }));
  if (textParts.length === 0) {
    textParts.push({ type: 'input_text', text: '' });
  }
  return [
    {
      type: 'message',
      role: 'user',
      content: textParts,
    },
  ];
}

// Transform agent events into ChatKit thread events
// Matches Python implementation from https://github.com/openai/chatkit-python
export async function* stream_agent_response(
  agent_context: AgentContext,
  result: AsyncIterable<any>
): AsyncIterable<ThreadStreamEvent> {
  // Track state for converting raw_model_stream_event to raw_response_event format
  let currentItemId: string | null = null;
  let currentContentIndex = 0;
  let accumulatedText = '';

  for await (const event of result) {
    // Skip run_item_stream_event (handled internally by agents-core)
    if (event.type === 'run_item_stream_event') {
      continue;
    }

    // Convert raw_model_stream_event to raw_response_event format if needed
    if (event.type === 'raw_model_stream_event') {
      const eventData = event.data;
      
      // Handle response_done event - extract final text
      if (eventData?.type === 'response_done' && eventData?.response) {
        const response = eventData.response;
        const output = response.output || [];
        const messageItem = output.find((item: any) => item.type === 'message' && item.role === 'assistant');
        
        if (messageItem && messageItem.content) {
          const textContent = Array.isArray(messageItem.content)
            ? messageItem.content
                .filter((c: any) => c.type === 'output_text')
                .map((c: any) => c.text || '')
                .join('')
            : messageItem.content?.text || accumulatedText || '';

          // Generate item_id if not set
          if (!currentItemId) {
            currentItemId = messageItem.id || agent_context.store.generate_item_id(agent_context.request_context) || `item_${Date.now()}`;
          }

          // Update accumulated text if we haven't been tracking it
          if (!accumulatedText && textContent) {
            accumulatedText = textContent;
          }

          // Emit response.output_item.added if we haven't yet
          if (accumulatedText === textContent || !currentItemId) {
            yield {
              type: 'thread.item.added',
              item: {
                type: 'assistant_message',
                id: currentItemId,
                thread_id: agent_context.thread.id,
                content: [],
                created_at: new Date(),
              },
            } as ThreadStreamEvent;

            yield {
              type: 'thread.item.updated',
              item_id: currentItemId,
              update: {
                type: 'assistant_message.content_part.added',
                content_index: currentContentIndex,
                content: {
                  type: 'output_text',
                  text: '',
                  annotations: [],
                },
              },
            } as ThreadStreamEvent;
          }

          // Emit response.output_text.done (only if we haven't already emitted it)
          // But always emit it to ensure proper completion
          yield {
            type: 'thread.item.updated',
            item_id: currentItemId,
            update: {
              type: 'assistant_message.content_part.done',
              content_index: currentContentIndex,
              content: {
                type: 'output_text',
                text: textContent,
                annotations: [],
              },
            },
          } as ThreadStreamEvent;

          // Emit response.output_item.done
          yield {
            type: 'thread.item.done',
            item: {
              type: 'assistant_message',
              id: currentItemId,
              thread_id: agent_context.thread.id,
              content: [
                {
                  type: 'output_text',
                  text: textContent,
                  annotations: [],
                },
              ],
              created_at: new Date(),
            },
          } as ThreadStreamEvent;
        }
        continue;
      }

      // Handle text delta events
      const innerEvent = eventData?.event || eventData;
      let delta: string | null = null;
      if (eventData?.type === 'output_text_delta' && eventData?.delta) {
        delta = eventData.delta;
      } else if (innerEvent?.type === 'output_text_delta') {
        delta = innerEvent.delta;
      } else if (innerEvent?.type === 'model' && innerEvent?.choices?.[0]?.delta?.content) {
        delta = innerEvent.choices[0].delta.content;
      }

      if (delta) {
        accumulatedText += delta;
        
        // Generate item_id if not set
        if (!currentItemId) {
          currentItemId = agent_context.store.generate_item_id(agent_context.request_context) || `item_${Date.now()}`;
        }

        // Emit response.output_item.added on first delta
        if (accumulatedText === delta) {
          yield {
            type: 'thread.item.added',
            item: {
              type: 'assistant_message',
              id: currentItemId,
              thread_id: agent_context.thread.id,
              content: [],
              created_at: new Date(),
            },
          } as ThreadStreamEvent;
        }

        // Emit response.content_part.added on first delta
        if (accumulatedText === delta) {
          yield {
            type: 'thread.item.updated',
            item_id: currentItemId,
            update: {
              type: 'assistant_message.content_part.added',
              content_index: currentContentIndex,
              content: {
                type: 'output_text',
                text: '',
                annotations: [],
              },
            },
          } as ThreadStreamEvent;
        }

        // Emit response.output_text.delta
        yield {
          type: 'thread.item.updated',
          item_id: currentItemId,
          update: {
            type: 'assistant_message.content_part.text_delta',
            content_index: currentContentIndex,
            delta: delta,
          },
        } as ThreadStreamEvent;
      }
      
      // Check for done event in model choices
      if (innerEvent?.type === 'model' && innerEvent?.choices?.[0]?.finish_reason) {
        // Emit response.output_text.done
        yield {
          type: 'thread.item.updated',
          item_id: currentItemId!,
          update: {
            type: 'assistant_message.content_part.done',
            content_index: currentContentIndex,
            content: {
              type: 'output_text',
              text: accumulatedText,
              annotations: [],
            },
          },
        } as ThreadStreamEvent;

        // Emit response.output_item.done
        yield {
          type: 'thread.item.done',
          item: {
            type: 'assistant_message',
            id: currentItemId!,
            thread_id: agent_context.thread.id,
            content: [
              {
                type: 'output_text',
                text: accumulatedText,
                annotations: [],
              },
            ],
            created_at: new Date(),
          },
        } as ThreadStreamEvent;
      }
      
      continue;
    }

    // Handle raw_response_event (Python format)
    if (event.type !== 'raw_response_event') {
      // Ignore everything else that isn't a raw response event
      continue;
    }

    // Handle Responses API events
    const responseEvent = event.data;
    if (!responseEvent) {
      continue;
    }

    if (responseEvent.type === 'response.content_part.added') {
      if (responseEvent.part?.type === 'reasoning_text') {
        continue;
      }
      const content = {
        type: 'output_text',
        text: responseEvent.part?.text || '',
        annotations: responseEvent.part?.annotations?.map((a: any) => ({
          source: a.source || {},
          index: a.index,
        })) || [],
      };
      yield {
        type: 'thread.item.updated',
        item_id: responseEvent.item_id,
        update: {
          type: 'assistant_message.content_part.added',
          content_index: responseEvent.content_index,
          content: content,
        },
      } as ThreadStreamEvent;
    } else if (responseEvent.type === 'response.output_text.delta') {
      yield {
        type: 'thread.item.updated',
        item_id: responseEvent.item_id,
        update: {
          type: 'assistant_message.content_part.text_delta',
          content_index: responseEvent.content_index,
          delta: responseEvent.delta,
        },
      } as ThreadStreamEvent;
    } else if (responseEvent.type === 'response.output_text.done') {
      yield {
        type: 'thread.item.updated',
        item_id: responseEvent.item_id,
        update: {
          type: 'assistant_message.content_part.done',
          content_index: responseEvent.content_index,
          content: {
            type: 'output_text',
            text: responseEvent.text,
            annotations: [],
          },
        },
      } as ThreadStreamEvent;
    } else if (responseEvent.type === 'response.output_text.annotation.added') {
      // Ignore annotation-added events; annotations are reflected in the final item content.
      continue;
    } else if (responseEvent.type === 'response.output_item.added') {
      const item = responseEvent.item;
      if (item.type === 'message') {
        const content = (item.content || []).map((c: any) => ({
          type: 'output_text',
          text: c.text || '',
          annotations: [],
        }));
        yield {
          type: 'thread.item.added',
          item: {
            type: 'assistant_message',
            id: item.id,
            thread_id: agent_context.thread.id,
            content: content,
            created_at: new Date(),
          },
        } as ThreadStreamEvent;
      }
    } else if (responseEvent.type === 'response.output_item.done') {
      const item = responseEvent.item;
      if (item.type === 'message') {
        const content = (item.content || []).map((c: any) => ({
          type: 'output_text',
          text: c.text || '',
          annotations: [],
        }));
        yield {
          type: 'thread.item.done',
          item: {
            type: 'assistant_message',
            id: item.id,
            thread_id: agent_context.thread.id,
            content: content,
            created_at: new Date(),
          },
        } as ThreadStreamEvent;
      }
    }
  }
}

// CamelCase aliases for TypeScript
export const simpleToAgentInput = simple_to_agent_input;
export const streamAgentResponse = stream_agent_response;


