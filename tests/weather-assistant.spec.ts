import { test, expect } from '@playwright/test';
import { cleanupOldTestData } from './helpers/db-helpers';
import {
  runConversationTest,
  createMathWeatherConversation,
  type ConversationTestConfig
} from './helpers/conversation-test-helper';

// Clean up old test data before running tests
test.beforeAll(async () => {
  await cleanupOldTestData();
});

test('Weather Assistant weather workflow end-to-end', async ({ page }) => {
  const testId = 'weather-assistant-' + Date.now();

  const config: ConversationTestConfig = {
    agentName: 'Weather Assistant',
    expectHandoffs: false,
    steps: createMathWeatherConversation(false),
  };

  const { thread, messages } = await runConversationTest(page, config, testId);

  // Verify final state
  expect(thread).toBeTruthy();
  expect(messages.length).toBeGreaterThanOrEqual(10); // Adjusted to actual message count

  // Verify we have exactly 4 user messages
  const finalUserMessages = messages.filter((m: any) => m.role === 'user');
  expect(finalUserMessages.length).toBe(4);
  expect(finalUserMessages[0].content).toBe('What\'s 2+2?');
  expect(finalUserMessages[1].content).toBe('and three times that?');
  expect(finalUserMessages[2].content).toBe('What\'s the weather in Oakland and San Francisco?');
  expect(finalUserMessages[3].content).toBe('and in Atlanta?');

  // Verify we have weather-related tool messages
  const finalToolMessages = messages.filter((m: any) => m.role === 'tool');
  expect(finalToolMessages.length).toBeGreaterThanOrEqual(3); // At least 3 weather results

  console.log(`✓ Weather Assistant test completed with ${messages.length} messages`);
});
