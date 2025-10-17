import { z } from 'zod';

export const thinkTool = {
  name: 'think',
  definition: {
    title: 'Think Tool',
    description:
      'Use this tool to think through a problem step by step. This tool does not retrieve new information or change any data, but provides a space for structured reasoning about existing information. Use it to process tool call results carefully, check if all required information is collected, verify compliance with guidelines, and perform reasoning on new information.',
    inputSchema: {
      thought: z
        .string()
        .describe(
          'Your thought process or reasoning about the current situation'
        ),
    },
    outputSchema: { result: z.string() },
  },
  handler: ({ thought }: { thought: string }) => {
    console.log('[Think Tool] Thought recorded:', thought);

    return {
      content: [
        {
          type: 'text',
          text: `Thought recorded: ${thought}`,
        },
      ],
      structuredContent: { result: `Thought recorded: ${thought}` },
    };
  },
};
