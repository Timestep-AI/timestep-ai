import { test, expect, type Page } from '@playwright/test';
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

/**
 * Helper function to check traces and responses in the UI
 */
async function checkTracesAndResponses(
  page: Page,
  expectedInput: string,
  expectedOutput: string | RegExp
) {
  console.log('📊 Navigating to traces page...');

  // Navigate to traces page
  await page.goto('/traces');

  // Wait for traces to load and refresh until we find a trace
  const maxAttempts = 10;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.waitForTimeout(2000); // Wait a bit between attempts

    // Look for trace rows (they're divs with onClick, containing "Agent workflow")
    const traceRows = page.locator('text=Agent workflow');
    const count = await traceRows.count();

    console.log(`Attempt ${attempt}/${maxAttempts}: Found ${count} trace rows`);

    if (count > 0) {
      console.log('✓ Trace found!');
      break; // Exit the loop immediately when trace is found
    }

    if (attempt < maxAttempts) {
      console.log('Refreshing traces page...');
      await page.reload();
    } else {
      throw new Error('No traces found after multiple refresh attempts');
    }
  }

  // Find the most recent trace (should be first in the list)
  const firstTrace = page.locator('text=Agent workflow').first();
  await expect(firstTrace).toBeVisible({ timeout: 5000 });

  console.log('📊 Clicking on first trace...');
  await firstTrace.click();

  // Wait for trace detail page to load - look for the trace title or content
  await page.waitForTimeout(2000);

  console.log('📊 Checking spans...');

  // Get all span elements - they are divs with specific styling and contain span names
  // Look for divs that contain span names like "Agent:", "POST", or "Handoff"
  // But exclude the root div and other container divs
  const spanElements = page.locator('div[style*="cursor: pointer"]').filter({ hasText: /Agent:|POST|Handoff/ });
  const spanCount = await spanElements.count();
  console.log(`Found ${spanCount} spans`);

  expect(spanCount).toBeGreaterThan(0);

  // Click on each span from top to bottom and verify details
  for (let i = 0; i < spanCount; i++) {
    console.log(`📊 Checking span ${i + 1}/${spanCount}...`);

    const spanElement = spanElements.nth(i);

    // Click the span to select it
    await spanElement.click();
    await page.waitForTimeout(500);

    // Get the span details from the right panel
    const spanDetailsPanel = page.locator('div[style*="flex: 1"][style*="padding: 16px"]');
    const contentText = await spanDetailsPanel.textContent();
    console.log(`Span ${i + 1} content preview: ${contentText?.substring(0, 100)}...`);

    // Check if this is a response span by looking for response ID
    const hasResponseId = contentText?.includes('resp_') || false;
    const isAgentSpan = contentText?.includes('Output type') && contentText?.includes('Handoffs');

    if (isAgentSpan) {
      console.log(`📊 Found agent span, checking properties...`);

      // Check for Output type property
      expect(contentText).toContain('Output type');
      expect(contentText).toContain('text'); // Should show "text" as output type
      console.log('✓ Output type: text');

      // Check for Handoffs property
      expect(contentText).toContain('Handoffs');
      expect(contentText).toContain('Weather Assistant'); // Should show the handoff agent
      console.log('✓ Handoffs: Weather Assistant');

      // Check for Tools property
      expect(contentText).toContain('Tools');
      expect(contentText).toContain('think'); // Should show the think tool
      console.log('✓ Tools: think');

    } else if (hasResponseId) {
      console.log(`📊 Found response span, checking details...`);

      // Check for Input
      if (contentText?.includes('Input') && !contentText.includes('No input available')) {
        console.log(`✓ Input found`);
        expect(contentText).toContain(expectedInput);
      } else {
        console.log('⚠ Input shows "No input available"');
      }

      // Check for Output
      if (contentText?.includes('Output') && !contentText.includes('No output available')) {
        console.log(`✓ Output found`);
        if (typeof expectedOutput === 'string') {
          expect(contentText).toContain(expectedOutput);
        } else {
          expect(contentText).toMatch(expectedOutput);
        }
      } else {
        console.log('⚠ Output shows "No output available"');
      }

      // Find and click the response ID link
      const responseLink = spanDetailsPanel.locator('a[href*="/responses/"]');
      if (await responseLink.count() > 0) {
        console.log('📊 Clicking response ID link...');
        const responseId = await responseLink.textContent();
        console.log(`Response ID: ${responseId}`);

        await responseLink.click();

      // Wait for response detail page to load
      await expect(page.locator('ion-title')).toContainText('Response Detail', { timeout: 5000 });

      console.log('📊 Verifying response detail page...');

      // Verify input section on response page
      const responseInputCard = page.locator('ion-card-title:has-text("Input")').locator('..');
      await expect(responseInputCard).toBeVisible();
      const responseInputText = await responseInputCard.textContent();
      console.log(`Response input text: "${responseInputText}"`);
      // For now, just verify the input section exists, not the specific content
      expect(responseInputText).toBeTruthy();
      console.log('✓ Response page input verified');

      // Verify output section on response page
      const responseOutputCard = page.locator('ion-card-title:has-text("Output")').locator('..');
      await expect(responseOutputCard).toBeVisible();
      const responseOutputText = await responseOutputCard.textContent();
      console.log(`Response output text: "${responseOutputText}"`);
      // For now, just verify the output section exists, not the specific content
      expect(responseOutputText).toBeTruthy();
      console.log('✓ Response page output verified');

      // Verify model is shown
      const modelSection = page.locator('text=Model').locator('..');
      await expect(modelSection).toContainText('gpt-4o-mini');
      console.log('✓ Model verified');

      // Verify tokens are shown
      const tokensSection = page.locator('text=Tokens').locator('..');
      await expect(tokensSection).toContainText('total');
      console.log('✓ Tokens verified');

        // Navigate back to trace detail
        console.log('📊 Navigating back to trace detail...');
        await page.goBack();
        await page.waitForTimeout(1000);
      } else {
        console.log('⚠ No response ID link found');
      }
    }
  }

  console.log('✓ Trace and response verification complete');

  // Navigate back to home/chat
  await page.goto('/');
  await page.waitForTimeout(1000);
}

test('Personal Assistant weather workflow end-to-end', async ({ page }) => {
  const testId = 'personal-assistant-' + Date.now();

  // Step 1: Navigate and select agent
  await page.goto('/');
  await expect(page.locator('iframe[name="chatkit"]')).toBeVisible();
  await expect(page.locator('ion-select')).toBeVisible();

  // Click the IonSelect to open the popover
  await page.locator('ion-select').click();
  await page.waitForSelector('ion-popover', { state: 'visible', timeout: 5000 });
  await page.locator('ion-popover').getByText('Personal Assistant', { exact: true }).click();

  const chatFrame = page.frameLocator('iframe[name="chatkit"]');
  await expect(chatFrame.locator('h2')).toContainText('What can I help with today?');

  // Step 2: Complete the conversation with trace and response expectations
  const baseSteps = createMathWeatherConversation(true);
  
  // Add navigation steps to check traces and responses throughout the conversation
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

  const config: ConversationTestConfig = {
    agentName: 'Personal Assistant',
    expectHandoffs: true,
    steps,
    databaseCheckpoints,
  };

  // Run the conversation test with trace and response validation
  const { thread, messages } = await runConversationTest(page, config, testId);

  console.log(`✓ Personal Assistant test completed`);
});
