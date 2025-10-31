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

// Pass-through stream helper to mirror Python signature
export async function* stream_agent_response(
  _agent_context: AgentContext,
  result: AsyncIterable<any>
): AsyncIterable<ThreadStreamEvent> {
  for await (const event of result) {
    yield event as ThreadStreamEvent;
  }
}

// CamelCase aliases for TypeScript
export const simpleToAgentInput = simple_to_agent_input;
export const streamAgentResponse = stream_agent_response;


