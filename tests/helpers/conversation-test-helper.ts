import { expect, type Page, type FrameLocator } from '@playwright/test';
import { initializeAuth, getLatestThread, getThreadMessages, getThreadRunStates } from './db-helpers';

export interface ConversationStep {
  type: 'message' | 'approval';
  message?: string;
  expectedResponse?: string | RegExp;
  expectedInUI?: string[];
  approvalIndex?: number;
  checkpointAfter?: string; // Name of checkpoint to run after this step
}

export interface MessageExpectation {
  role: 'user' | 'assistant' | 'tool';
  contentContains?: string;
  contentEquals?: string;
  hasToolCalls?: boolean;
  toolCallsNull?: boolean;
}

export interface DatabaseCheckpoint {
  stepName: string;
  messageCount: number | { min: number; max: number };
  messageExpectations?: MessageExpectation[];
  customAssertions?: (messages: any[]) => void | Promise<void>;
}

export interface ConversationTestConfig {
  agentName: string;
  expectHandoffs: boolean;
  steps: ConversationStep[];
  databaseCheckpoints?: Map<string, DatabaseCheckpoint>;
}

/**
 * Runs a complete conversation test with the specified agent and conversation flow.
 * This helper abstracts the common pattern of:
 * 1. Selecting an agent
 * 2. Sending messages and approving tool calls
 * 3. Validating database state at various checkpoints
 */
export async function runConversationTest(
  page: Page,
  config: ConversationTestConfig,
  testId: string
) {
  const { agentName, expectHandoffs, steps, databaseCheckpoints = [] } = config;

  // Step 1: Navigate and select agent
  await page.goto('/');
  await expect(page.locator('iframe[name="chatkit"]')).toBeVisible();
  await expect(page.locator('[role="combobox"]')).toBeVisible();

  // Wait for agents to load (only for Weather Assistant which needs more time)
  if (agentName === 'Weather Assistant') {
    await page.waitForTimeout(5000);
  }

  await page.locator('[role="combobox"]').click();

  // Wait for options to load (only for Weather Assistant)
  if (agentName === 'Weather Assistant') {
    await page.waitForTimeout(2000);
  }

  await page.locator(`[role="option"]:has-text("${agentName}")`).click();

  const chatFrame = page.frameLocator('iframe[name="chatkit"]');
  await expect(chatFrame.locator('h2')).toContainText(
    `Welcome to Timestep AI! You're chatting with ${agentName}`
  );

  // Initialize database auth
  await initializeAuth();

  // Execute conversation steps
  let approvalCount = 0;

  for (const step of steps) {
    if (step.type === 'message') {
      // Send a message
      await chatFrame.getByRole('textbox', { name: 'Type your question…' }).fill(step.message!);

      // Use Enter for Weather Assistant, Send button for Personal Assistant
      if (agentName === 'Weather Assistant') {
        await chatFrame.getByRole('textbox', { name: 'Type your question…' }).press('Enter');
      } else {
        await chatFrame.getByRole('button', { name: 'Send message' }).click();
      }

      // Wait for expected response
      if (step.expectedResponse) {
        if (typeof step.expectedResponse === 'string') {
          await expect(chatFrame.locator(`text=${step.expectedResponse}`)).toBeVisible({
            timeout: 15000
          });
        } else {
          // Handle RegExp
          await expect(chatFrame.locator('body')).toContainText(step.expectedResponse, {
            timeout: 15000
          });
        }
      }

      // Wait for expected UI elements
      if (step.expectedInUI) {
        for (const text of step.expectedInUI) {
          // Use .first() to avoid strict mode violations when multiple elements match
          await expect(chatFrame.locator(`text=${text}`).first()).toBeVisible({ timeout: 15000 });
        }
      }

    } else if (step.type === 'approval') {
      // Approve a tool call
      // Strategy: Always click the first visible approve button, as that's the next one to process
      const approveButtons = chatFrame.getByRole('button', { name: 'Approve' });

      // Wait for at least one approval button to be visible
      await expect(approveButtons.first()).toBeVisible({ timeout: 20000 });

      // Click the first approve button (the next one in the queue)
      await approveButtons.first().click();
      approvalCount++;

      // Wait a moment for the UI to update after approval
      await page.waitForTimeout(1000);

      // Wait for expected response if specified
      if (step.expectedResponse) {
        if (typeof step.expectedResponse === 'string') {
          await expect(chatFrame.locator(`text=${step.expectedResponse}`)).toBeVisible({ timeout: 15000 });
        }
      }
    }

    // Check if there's a database checkpoint for this step
    if (step.checkpointAfter && databaseCheckpoints) {
      const checkpoint = databaseCheckpoints.get(step.checkpointAfter);
      if (checkpoint) {
        // Add a small delay to ensure database is updated
        await page.waitForTimeout(2000);

        const thread = await getLatestThread(testId);
        expect(thread, `Thread not found for checkpoint: ${checkpoint.stepName}`).toBeTruthy();

        const messages = await getThreadMessages(thread.id);

        // Check message count
        if (typeof checkpoint.messageCount === 'number') {
          expect(
            messages.length,
            `Expected ${checkpoint.messageCount} messages at checkpoint "${checkpoint.stepName}", got ${messages.length}`
          ).toBe(checkpoint.messageCount);
        } else {
          expect(
            messages.length,
            `Expected ${checkpoint.messageCount.min}-${checkpoint.messageCount.max} messages at checkpoint "${checkpoint.stepName}", got ${messages.length}`
          ).toBeGreaterThanOrEqual(checkpoint.messageCount.min);
          expect(
            messages.length,
            `Expected ${checkpoint.messageCount.min}-${checkpoint.messageCount.max} messages at checkpoint "${checkpoint.stepName}", got ${messages.length}`
          ).toBeLessThanOrEqual(checkpoint.messageCount.max);
        }

        // Check message expectations
        if (checkpoint.messageExpectations) {
          for (let i = 0; i < checkpoint.messageExpectations.length; i++) {
            const expectation = checkpoint.messageExpectations[i];
            const message = messages[i];

            expect(
              message.role,
              `Message ${i} role mismatch at checkpoint "${checkpoint.stepName}"`
            ).toBe(expectation.role);

            if (expectation.contentContains !== undefined) {
              expect(
                message.content,
                `Message ${i} content should contain "${expectation.contentContains}" at checkpoint "${checkpoint.stepName}"`
              ).toContain(expectation.contentContains);
            }

            if (expectation.contentEquals !== undefined) {
              expect(
                message.content,
                `Message ${i} content mismatch at checkpoint "${checkpoint.stepName}"`
              ).toBe(expectation.contentEquals);
            }

            if (expectation.hasToolCalls !== undefined) {
              if (expectation.hasToolCalls) {
                expect(
                  message.tool_calls,
                  `Message ${i} should have tool calls at checkpoint "${checkpoint.stepName}"`
                ).not.toBeNull();
              } else {
                expect(
                  message.tool_calls,
                  `Message ${i} should not have tool calls at checkpoint "${checkpoint.stepName}"`
                ).toBeNull();
              }
            }

            if (expectation.toolCallsNull !== undefined) {
              if (expectation.toolCallsNull) {
                expect(
                  message.tool_calls,
                  `Message ${i} tool_calls should be null at checkpoint "${checkpoint.stepName}"`
                ).toBeNull();
              }
            }
          }
        }

        // Run custom assertions
        if (checkpoint.customAssertions) {
          await checkpoint.customAssertions(messages);
        }
      }
    }
  }

  // Return the final thread and messages for additional assertions
  // Note: We don't filter by testId for now since parallel isolation is handled by time-based filtering
  const thread = await getLatestThread();
  const messages = await getThreadMessages(thread.id);

  return { thread, messages };
}

/**
 * Creates a standard math + weather conversation flow.
 * This is the common flow used by both Personal Assistant and Weather Assistant tests.
 */
export function createMathWeatherConversation(
  expectHandoffs: boolean
): ConversationTestConfig['steps'] {
  const steps: ConversationStep[] = [
    // Math question 1
    {
      type: 'message',
      message: 'What\'s 2+2?',
      expectedResponse: '4',
    },
    // Math question 2
    {
      type: 'message',
      message: 'and three times that?',
      expectedResponse: '12',
    },
    // Weather question
    {
      type: 'message',
      message: 'What\'s the weather in Oakland and San Francisco?',
      expectedInUI: expectHandoffs
        ? ['Agent Transfer', 'Transfer Complete', 'Tool approval required']
        : ['Tool approval required'],
    },
    // Approve first weather request (Oakland or San Francisco)
    {
      type: 'approval',
      // Don't check for specific city, just that we get weather data
      expectedResponse: 'United States:',
    },
    // Approve second weather request (Oakland or San Francisco)
    {
      type: 'approval',
      expectedResponse: 'United States:',
    },
    // Follow-up weather question
    {
      type: 'message',
      message: 'and in Atlanta?',
      expectedInUI: expectHandoffs
        ? ['Agent Transfer', 'Transfer Complete', 'Tool approval required']
        : ['Tool approval required'],
    },
    // Approve Atlanta weather
    {
      type: 'approval',
      expectedResponse: 'Atlanta',
    },
  ];

  return steps;
}

/**
 * Creates standard database checkpoints for the math + weather conversation.
 */
export function createMathWeatherCheckpoints(
  expectHandoffs: boolean
): DatabaseCheckpoint[] {
  if (expectHandoffs) {
    // Personal Assistant with handoffs
    return [
      {
        stepName: 'After initial weather question',
        messageCount: { min: 9, max: 10 }, // Account for bug message
        messageExpectations: [
          { role: 'user', contentEquals: 'What\'s 2+2?', toolCallsNull: true },
          { role: 'assistant', contentContains: '4', toolCallsNull: true },
          { role: 'user', contentEquals: 'and three times that?', toolCallsNull: true },
          { role: 'assistant', contentContains: '12', toolCallsNull: true },
          { role: 'user', contentEquals: 'What\'s the weather in Oakland and San Francisco?', toolCallsNull: true },
          { role: 'assistant', contentEquals: '', hasToolCalls: true },
        ],
        customAssertions: async (messages) => {
          // Verify we have assistant messages with tool calls
          const assistantMessagesWithToolCalls = messages.filter(
            m => m.role === 'assistant' && m.tool_calls !== null
          );
          expect(assistantMessagesWithToolCalls.length).toBeGreaterThanOrEqual(2);
        },
      },
      {
        stepName: 'After first approval (Oakland)',
        messageCount: { min: 10, max: 11 },
        customAssertions: async (messages) => {
          const lastMessage = messages[messages.length - 1];
          expect(lastMessage.role).toBe('tool');
          expect(lastMessage.content).toContain('Weather in Oakland');
          expect(lastMessage.content).toContain('°C');
        },
      },
      {
        stepName: 'After second approval (San Francisco)',
        messageCount: { min: 11, max: 13 },
        customAssertions: async (messages) => {
          const sanFranciscoMessage = messages.find(
            m => m.role === 'tool' &&
            m.content?.includes('Weather in San Francisco') &&
            m.content?.includes('°C')
          );
          expect(sanFranciscoMessage).toBeTruthy();
        },
      },
      {
        stepName: 'After Atlanta question',
        messageCount: { min: 15, max: 17 },
        customAssertions: async (messages) => {
          const followUpUserMessage = messages.find(
            m => m.role === 'user' && m.content === 'and in Atlanta?'
          );
          expect(followUpUserMessage).toBeTruthy();
        },
      },
      {
        stepName: 'Final state after Atlanta approval',
        messageCount: { min: 17, max: 18 },
        customAssertions: async (messages) => {
          // Verify all user messages
          const finalUserMessages = messages.filter(m => m.role === 'user');
          expect(finalUserMessages.length).toBe(4);
          expect(finalUserMessages[0].content).toBe('What\'s 2+2?');
          expect(finalUserMessages[1].content).toBe('and three times that?');
          expect(finalUserMessages[2].content).toBe('What\'s the weather in Oakland and San Francisco?');
          expect(finalUserMessages[3].content).toBe('and in Atlanta?');

          // Verify Atlanta weather result
          const atlantaToolMessage = messages.find(
            m => m.role === 'tool' &&
            m.content.includes('Weather in Atlanta') &&
            m.content.includes('°C')
          );
          expect(atlantaToolMessage).toBeTruthy();
        },
      },
    ];
  } else {
    // Weather Assistant without handoffs
    return [
      {
        stepName: 'After initial weather question',
        messageCount: 7,
        messageExpectations: [
          { role: 'user', contentEquals: 'What\'s 2+2?', toolCallsNull: true },
          { role: 'assistant', contentContains: '4', toolCallsNull: true },
          { role: 'user', contentEquals: 'and three times that?', toolCallsNull: true },
          { role: 'assistant', contentContains: '12', toolCallsNull: true },
          { role: 'user', contentEquals: 'What\'s the weather in Oakland and San Francisco?', toolCallsNull: true },
        ],
        customAssertions: async (messages) => {
          const assistantMessagesWithToolCalls = messages.filter(
            m => m.role === 'assistant' && m.tool_calls !== null
          );
          expect(assistantMessagesWithToolCalls.length).toBe(2); // Oakland + San Francisco
        },
      },
      {
        stepName: 'After first approval (Oakland)',
        messageCount: 8,
        customAssertions: async (messages) => {
          const lastMessage = messages[messages.length - 1];
          expect(lastMessage.role).toBe('tool');
          expect(lastMessage.content).toContain('Weather in Oakland');
          expect(lastMessage.content).toContain('°C');
        },
      },
      {
        stepName: 'After second approval (San Francisco)',
        messageCount: { min: 9, max: 10 },
        customAssertions: async (messages) => {
          const sanFranciscoMessage = messages.find(
            m => m.role === 'tool' &&
            m.content?.includes('Weather in San Francisco') &&
            m.content?.includes('°C')
          );
          expect(sanFranciscoMessage).toBeTruthy();
        },
      },
      {
        stepName: 'After Atlanta question',
        messageCount: 12,
        customAssertions: async (messages) => {
          const followUpUserMessage = messages.find(
            m => m.role === 'user' && m.content === 'and in Atlanta?'
          );
          expect(followUpUserMessage).toBeTruthy();
        },
      },
      {
        stepName: 'Final state after Atlanta approval',
        messageCount: { min: 13, max: 14 },
        customAssertions: async (messages) => {
          const finalUserMessages = messages.filter(m => m.role === 'user');
          expect(finalUserMessages.length).toBe(4);
          expect(finalUserMessages[0].content).toBe('What\'s 2+2?');
          expect(finalUserMessages[1].content).toBe('and three times that?');
          expect(finalUserMessages[2].content).toBe('What\'s the weather in Oakland and San Francisco?');
          expect(finalUserMessages[3].content).toBe('and in Atlanta?');

          const atlantaToolMessage = messages.find(
            m => m.role === 'tool' &&
            m.content.includes('Weather in Atlanta') &&
            m.content.includes('°C')
          );
          expect(atlantaToolMessage).toBeTruthy();

          // Verify assistant and tool message counts
          const finalAssistantMessages = messages.filter(m => m.role === 'assistant');
          expect(finalAssistantMessages.length).toBe(6); // 2 math + 4 weather tool calls

          const finalToolMessages = messages.filter(m => m.role === 'tool');
          expect(finalToolMessages.length).toBe(3); // 3 weather results
        },
      },
    ];
  }
}
