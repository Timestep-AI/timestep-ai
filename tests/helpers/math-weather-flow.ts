import type { ConversationStep } from './conversation-flow.ts';

// Personal Assistant flow - includes handoffs to Weather Assistant
export const personalAssistantFlow: ConversationStep[] = [
  { user: "What's 2+2?", expectAssistant: /4/ },
  { user: 'and three times that?', expectAssistant: /12/ },
  {
    user: "What's the weather in Oakland and San Francisco?",
    expectAssistant: /weather/i,
    approvals: ['Oakland', 'San Francisco'],
  },
  {
    user: 'and in Atlanta?',
    expectAssistant: /weather/i,
    approvals: ['Atlanta'],
  },
];

// Weather Assistant flow - no handoffs, direct weather handling
export const weatherAssistantFlow: ConversationStep[] = [
  { user: "What's 2+2?", expectAssistant: /4/ },
  { user: 'and three times that?', expectAssistant: /12/ },
  {
    user: "What's the weather in Oakland and San Francisco?",
    expectAssistant: /weather/i,
    approvals: ['Oakland', 'San Francisco'],
  },
  {
    user: 'and in Atlanta?',
    expectAssistant: /weather/i,
    approvals: ['Atlanta'],
  },
];

// Backward compatibility
export const mathWeatherFlow = personalAssistantFlow;
