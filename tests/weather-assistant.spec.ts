import { test, expect } from '@playwright/test';
import { cleanupOldTestData } from './helpers/db-helpers';
import {
  runConversationTest,
  createMathWeatherConversation,
  createComprehensiveCheckpoint,
  createValidateLatestTraceStep,
  type ConversationTestConfig
} from './helpers/conversation-test-helper';

// Clean up old test data before running tests
test.beforeAll(async () => {
  await cleanupOldTestData();
});

test('Weather Assistant weather workflow end-to-end', async ({ page }) => {
  const testId = 'weather-assistant-' + Date.now();

  // Create database checkpoints with trace and response expectations
  const databaseCheckpoints = new Map<string, DatabaseCheckpoint>([
    ['After first weather approval', createComprehensiveCheckpoint(
      'After first weather approval',
      { min: 8, max: 10 },
      {
        spanCount: { min: 1, max: 3 },
        spanTypes: ['Agent', 'POST'],
        hasSpansWithContent: ['weather', 'Oakland']
      },
      {
        responseCount: { min: 1, max: 3 },
        hasResponseWithContent: ['Weather in Oakland'],
        hasResponseWithInput: ['What\'s the weather in Oakland and San Francisco?']
      }
    )],
    ['After second weather approval', createComprehensiveCheckpoint(
      'After second weather approval',
      { min: 12, max: 14 },
      {
        spanCount: { min: 2, max: 4 },
        spanTypes: ['Agent', 'POST'],
        hasSpansWithContent: ['weather', 'San Francisco']
      },
      {
        responseCount: { min: 2, max: 4 },
        hasResponseWithContent: ['Weather in San Francisco'],
        hasResponseWithInput: ['What\'s the weather in Oakland and San Francisco?']
      }
    )],
    ['After Atlanta weather approval', createComprehensiveCheckpoint(
      'After Atlanta weather approval',
      { min: 16, max: 18 },
      {
        spanCount: { min: 3, max: 5 },
        spanTypes: ['Agent', 'POST'],
        hasSpansWithContent: ['weather', 'Atlanta']
      },
      {
        responseCount: { min: 3, max: 5 },
        hasResponseWithContent: ['Weather in Atlanta'],
        hasResponseWithInput: ['and in Atlanta?']
      }
    )]
  ]);

  // Create conversation steps with navigation to traces and responses
  const baseSteps = createMathWeatherConversation(false);
  
  const steps = [
    ...baseSteps.slice(0, 2), // Math questions
    ...baseSteps.slice(2, 3), // First weather question
    ...baseSteps.slice(3, 4), // First approval
    ...baseSteps.slice(4, 5), // Second approval
    ...baseSteps.slice(5, 6), // Atlanta question
    ...baseSteps.slice(6, 7), // Atlanta approval
    // Validate the latest trace after completing the conversation
    createValidateLatestTraceStep(
      'Agent workflow', // Expected trace name
      ['agent', 'response'], // Expected span types
      { min: 6, max: 10 } // Expected spans count
    ),
  ];

  const config: ConversationTestConfig = {
    agentName: 'Weather Assistant',
    expectHandoffs: false,
    steps,
    databaseCheckpoints,
  };

  const { thread, messages } = await runConversationTest(page, config, testId);

  // Verify final state
  expect(thread).toBeTruthy();
  expect(messages.length).toBeGreaterThanOrEqual(10); // Should have 4 user + 6+ assistant/tool messages

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
