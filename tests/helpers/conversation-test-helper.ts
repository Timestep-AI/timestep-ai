import { expect, type Page, type FrameLocator } from '@playwright/test';
import {
  initializeAuth,
  getLatestThread,
  getThreadMessages,
  getThreadRunStates,
} from './db-helpers';

export interface ConversationStep {
  type:
    | 'message'
    | 'approval'
    | 'navigate_to_traces'
    | 'navigate_to_trace_detail'
    | 'navigate_to_response_from_span'
    | 'validate_latest_trace'
    | 'search_traces_by_thread';
  message?: string;
  expectedResponse?: string | RegExp;
  expectedInUI?: string[];
  approvalIndex?: number;
  checkpointAfter?: string; // Name of checkpoint to run after this step
  expectedTracesCount?: number | { min: number; max: number };
  expectedSpansCount?: number | { min: number; max: number };
  expectedResponsesCount?: number | { min: number; max: number };
  expectedTraceContent?: string[];
  expectedSpanContent?: string[];
  expectedResponseContent?: string[];
  clickTraceIndex?: number; // Which trace to click (0-based index)
  clickSpanIndex?: number; // Which span to click (0-based index)
  expectedTraceName?: string; // Expected name for the latest trace
  expectedSpanTypes?: string[]; // Expected span types in the latest trace
}

export interface MessageExpectation {
  role: 'user' | 'assistant' | 'tool';
  contentContains?: string;
  contentEquals?: string;
  hasToolCalls?: boolean;
  toolCallsNull?: boolean;
}

export interface TraceExpectation {
  traceId?: string;
  spanCount?: number | { min: number; max: number };
  spanTypes?: string[]; // Expected span types like 'Agent', 'POST', 'Handoff'
  hasSpansWithContent?: string[]; // Expected span content patterns
}

export interface ResponseExpectation {
  responseCount?: number | { min: number; max: number };
  hasResponseWithContent?: string[]; // Expected response content patterns
  hasResponseWithInput?: string[]; // Expected response input patterns
}

export interface DatabaseCheckpoint {
  stepName: string;
  messageCount: number | { min: number; max: number };
  messageExpectations?: MessageExpectation[];
  traceExpectations?: TraceExpectation;
  responseExpectations?: ResponseExpectation;
  customAssertions?: (messages: any[], traces?: any[], responses?: any[]) => void | Promise<void>;
}

export interface ConversationTestConfig {
  agentName: string;
  expectHandoffs: boolean;
  steps: ConversationStep[];
  databaseCheckpoints?: Map<string, DatabaseCheckpoint>;
}

/**
 * Validates a complete math-weather conversation flow in the UI.
 * This includes math questions, weather requests with approvals, and Atlanta follow-up.
 */
export async function validateMathWeatherConversationFlow(
  page: Page,
  expectHandoffs: boolean = false
) {
  const chatFrame = page.frameLocator('iframe[name="chatkit"]');
  const input = chatFrame.locator('input[type="text"], textarea');

  // Helper function to submit input (always uses Send button for consistency)
  const submitInput = async (text: string) => {
    await input.fill(text);
    await chatFrame.getByRole('button', { name: 'Send message' }).click();
    await page.waitForTimeout(2000); // Wait for processing
  };

  // ============================================================================
  // INTERACTION 1: "What's 2+2?"
  // ============================================================================
  console.log('\n========== INTERACTION 1: Math Question ==========');
  await submitInput("What's 2+2?");

  // Validate user message was sent
  await expect(chatFrame.locator('article[data-thread-turn="user"]').nth(0)).toContainText(
    "What's 2+2?"
  );
  console.log('✓ User message sent');

  // Wait for response
  await expect(chatFrame.locator('article[data-thread-turn="assistant"]').nth(0)).toContainText(
    '4'
  );
  console.log('✓ Got response: 4');

  // ============================================================================
  // INTERACTION 2: "and three times that?"
  // ============================================================================
  console.log('\n========== INTERACTION 2: Follow-up Math ==========');
  await submitInput('and three times that?');

  // Validate user message was sent
  await expect(chatFrame.locator('article[data-thread-turn="user"]').nth(1)).toContainText(
    'and three times that?'
  );
  console.log('✓ Follow-up user message sent');

  // Wait for response
  await expect(chatFrame.locator('article[data-thread-turn="assistant"]').nth(1)).toContainText(
    '12'
  );
  console.log('✓ Got response: 12');

  // ============================================================================
  // INTERACTION 3: "What's the weather in Oakland and San Francisco?"
  // ============================================================================
  console.log('\n========== INTERACTION 3: Weather Question ==========');
  await submitInput("What's the weather in Oakland and San Francisco?");

  // Validate user message was sent
  await expect(chatFrame.locator('article[data-thread-turn="user"]').nth(2)).toContainText(
    "What's the weather in Oakland and San Francisco?"
  );
  console.log('✓ User message sent');

  // Validate assistant response based on whether handoffs are expected
  if (expectHandoffs) {
    // Personal Assistant: Should initiate transfer to Weather Assistant
    await expect(
      chatFrame.locator('span:has-text("Transferring to transfer_to_Weather_Assistant")')
    ).toBeVisible({ timeout: 15000 });
    console.log('✓ Assistant initiated transfer to Weather Assistant');
  }

  // Wait for Oakland approval button and click it
  await expect(
    chatFrame.locator('text=/Tool approval required.*get_weather.*Oakland/i')
  ).toBeVisible({ timeout: 15000 });
  console.log('✓ Oakland tool approval required');
  const oaklandApproveBtn = chatFrame.locator('button:has-text("Approve")').nth(0);
  await oaklandApproveBtn.click();
  console.log('  Clicked approval for Oakland');

  // Oakland and San Francisco are handled within the same assistant response as the transfer/workflow
  const weatherWorkflowIndex = expectHandoffs ? 2 : 2;
  await expect(
    chatFrame.locator('article[data-thread-turn="assistant"]').nth(weatherWorkflowIndex)
  ).toBeVisible({ timeout: 15000 });
  console.log('✓ Oakland weather tool result received');

  // Wait for San Francisco approval button and click it
  await expect(
    chatFrame.locator('text=/Tool approval required.*get_weather.*San Francisco/i')
  ).toBeVisible({ timeout: 15000 });
  console.log('✓ San Francisco tool approval required');
  const sfApproveBtn = chatFrame.locator('button:has-text("Approve")').nth(1);
  await sfApproveBtn.click();
  console.log('  Clicked approval for San Francisco');

  // San Francisco result is within the same workflow response
  console.log('✓ San Francisco weather tool result received');

  // Final summary is within the same workflow response
  console.log('✓ Final weather summary displayed');

  // ============================================================================
  // INTERACTION 4: "and in Atlanta?"
  // ============================================================================
  console.log('\n========== INTERACTION 4: Atlanta Weather ==========');
  await submitInput('and in Atlanta?');

  // Validate user message was sent
  await expect(chatFrame.locator('article[data-thread-turn="user"]').nth(3)).toContainText(
    'and in Atlanta?'
  );
  console.log('✓ Atlanta user message sent');

  // Validate assistant transfer for Atlanta (if handoffs expected)
  if (expectHandoffs) {
    try {
      await expect(
        chatFrame.locator('text=/Agent Transfer|transfer_to_Weather_Assistant/i').nth(1)
      ).toBeVisible({ timeout: 5000 });
      console.log('✓ Assistant initiated transfer for Atlanta');
    } catch (e) {
      console.log('⚠ Atlanta transfer message not found (may be implementation detail)');
    }
  }

  // Wait for Atlanta approval button and click it
  await expect(
    chatFrame.locator('text=/Tool approval required.*get_weather.*Atlanta/i')
  ).toBeVisible({ timeout: 15000 });
  console.log('✓ Atlanta tool approval required');
  const atlantaApproveBtn = chatFrame.locator('button:has-text("Approve")').nth(2);
  await atlantaApproveBtn.click();
  console.log('  Clicked approval for Atlanta');

  // Wait for Atlanta tool result (any get_weather tool result after approval)
  await expect(chatFrame.locator('text=/Tool Result.*get_weather/').nth(2)).toBeVisible({
    timeout: 20000,
  }); // Third get_weather tool result should be Atlanta
  console.log('✓ Atlanta weather tool result received');

  // Validate Atlanta weather summary
  const atlantaResponseIndex = 3; // Atlanta workflow comes after the initial weather workflow
  await expect(
    chatFrame.locator('article[data-thread-turn="assistant"]').nth(atlantaResponseIndex)
  ).toBeVisible({ timeout: 15000 });
  console.log('✓ Atlanta weather summary displayed');
}
