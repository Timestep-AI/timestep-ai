const { expect } = require('@playwright/test');

/**
 * 🏆 Gold Standard ChatKit Synchronization Helper (v2)
 *
 * Adds agent context verification and handoff sentinels.
 * Pattern: wait for node creation → click in scope → verify agent → wait for streamed diff → confirm text
 *
 * 🚫 HEADLESS MODE DISABLED
 * ChatKit requires a visual display context to mount its iframe and render
 * streaming updates correctly. All tests must run headed.
 *
 * CI automatically provides a virtual display via `xvfb-run`.
 */

// ============================================================================
// 🎛️  TIMEOUT CONFIGURATION
// ============================================================================

const TIMEOUTS = {
  ASSISTANT_TURN: process.env.CI ? 60000 : 30000, // Longer timeout in CI
  SEND_BUTTON: 10000,
};

async function runConversationFlow(page, steps) {
  // Check if ChatKit is in iframe (despite directive saying it shouldn't be)
  const iframeCount = await page.locator('iframe[name="chatkit"]').count();
  const root = iframeCount > 0 ? page.frameLocator('iframe[name="chatkit"]') : page;

  const input = root.locator('input[type="text"], textarea');
  const sendButton = root.getByRole('button', { name: /send/i });
  const assistantTurns = root.locator('article[data-thread-turn="assistant"]');

  let prevCount = await assistantTurns.count();

  for (const [i, step] of steps.entries()) {
    console.log(`\n========== STEP ${i + 1}: "${step.user}" ==========`);

    await input.fill(step.user);
    await sendButton.click();

    // --- Wait for new assistant message ---
    const newIndex = await waitForNextAssistantTurn(assistantTurns, prevCount);
    prevCount = newIndex + 1;
    const currentTurn = assistantTurns.nth(newIndex);

    // --- Wait for assistant response text (if expected) ---
    // This ensures the assistant turn is complete before verifying tool calls
    if (step.expectAssistant) {
      await expect
        .poll(async () => {
          return (await currentTurn.textContent()) || '';
        }, {
          message: 'Waiting for assistant response',
          timeout: TIMEOUTS.ASSISTANT_TURN,
        })
        .toMatch(step.expectAssistant);
      console.log(`✓ Assistant matched: ${step.expectAssistant}`);
    }

    // --- Verify tool call occurred (if expected) ---
    // This checks the actual thread items from the API, not just the assistant's response text
    // This is the primary verification - the tool call must actually exist in the thread items
    if (step.expectToolCall) {
      await verifyToolCall(root, page, step.expectToolCall);
    }

    // --- Verify widget is displayed (if expected) ---
    // This checks that a widget is actually rendered in the UI
    if (step.expectWidget) {
      await verifyWidget(root, currentTurn, step.expectWidget);
    }

    // --- Before next user turn ---
    await expect(sendButton).toBeEnabled({ timeout: TIMEOUTS.SEND_BUTTON });
    console.log(`✓ Send button enabled, ready for next step`);
  }
}

async function waitForNextAssistantTurn(assistantTurns, prevCount) {
  await expect
    .poll(async () => await assistantTurns.count(), {
      message: 'Waiting for new assistant turn',
      timeout: TIMEOUTS.ASSISTANT_TURN,
    })
    .toBeGreaterThan(prevCount);
  const count = await assistantTurns.count();
  console.log(`✓ Detected new assistant message (${count} total)`);
  return count - 1;
}

async function verifyToolCall(root, page, expectedToolCall) {
  console.log(`→ Verifying tool call: ${expectedToolCall.name} with params:`, expectedToolCall);
  
  // Wait for the tool call to be saved
  await page.waitForTimeout(2000);
  
  // Get auth token from Supabase session in localStorage
  const authToken = await page.evaluate(() => {
    // Supabase stores session in localStorage with key like "sb-<project-ref>-auth-token"
    // Find the Supabase auth token key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('auth-token')) {
        try {
          const sessionData = JSON.parse(localStorage.getItem(key));
          if (sessionData?.access_token) {
            return sessionData.access_token;
          }
        } catch (e) {
          // Not JSON or invalid
        }
      }
    }
    return null;
  });
  
  // Get Supabase URL from environment or default
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  
  // Get thread ID from the most recent thread via API
  const threadsResponse = await page.request.get(`${supabaseUrl}/functions/v1/openai-polyfill/chatkit/threads?limit=1&order=desc`, {
    headers: {
      'Authorization': `Bearer ${authToken || 'anonymous'}`,
      'OpenAI-Beta': 'chatkit_beta=v1',
    },
  });
  
  if (!threadsResponse.ok()) {
    throw new Error(`Failed to fetch threads: ${threadsResponse.status()} ${threadsResponse.statusText()}`);
  }
  
  const threadsData = await threadsResponse.json();
  if (!threadsData.data || threadsData.data.length === 0) {
    throw new Error('No threads found');
  }
  
  const threadId = threadsData.data[0].id;
  console.log(`Got thread ID from API: ${threadId}`);
  
  const apiUrl = `${supabaseUrl}/functions/v1/openai-polyfill/chatkit/threads/${threadId}/items?limit=50&order=desc`;
  
  // Fetch thread items from ChatKit API
  const response = await page.request.get(apiUrl, {
    headers: {
      'Authorization': `Bearer ${authToken || 'anonymous'}`,
      'OpenAI-Beta': 'chatkit_beta=v1',
    },
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to fetch thread items: ${response.status()} ${response.statusText()}`);
  }
  
  const data = await response.json();
  const items = data.data || [];
  
  // Find the client_tool_call item with matching name and arguments
  const toolCallItem = items.find((item) => {
    if (item.type !== 'chatkit.client_tool_call') return false;
    if (item.name !== expectedToolCall.name) return false;
    
    // Check arguments match
    const args = typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments;
    return Object.keys(expectedToolCall).every(key => {
      if (key === 'name') return true; // Already checked
      return args[key] === expectedToolCall[key];
    });
  });
  
  if (!toolCallItem) {
    throw new Error(
      `Tool call ${expectedToolCall.name} with params ${JSON.stringify(expectedToolCall)} not found in thread items`
    );
  }
  
  console.log(`✓ Tool call ${expectedToolCall.name} verified in thread items`);
}

async function verifyWidget(root, currentTurn, expectedWidget) {
  console.log(`→ Verifying widget: ${expectedWidget.type}`);

  // Wait a moment for widget to render
  await currentTurn.page().waitForTimeout(1000);

  // Get the HTML structure for debugging
  const turnHTML = await currentTurn.innerHTML();
  console.log(`→ Turn HTML length: ${turnHTML.length} chars`);

  // Check if there's a data-widget-type attribute anywhere in the turn
  const hasWidgetType = turnHTML.includes('data-widget-type');
  console.log(`→ Has data-widget-type: ${hasWidgetType}`);

  // ChatKit widgets are typically rendered with specific data attributes
  // The actual selector used by ChatKit is [data-thread-item="widget"]
  const selectors = [
    '[data-thread-item="widget"]',
    '[data-widget-type]',
    '[data-chatkit-widget]',
    '[data-testid*="widget"]',
    'div[class*="Widget"]',
    'div[class*="Card"]',
  ];

  let widget = null;
  for (const selector of selectors) {
    const found = currentTurn.locator(selector).first();
    const count = await found.count();
    if (count > 0) {
      widget = found;
      console.log(`✓ Found widget with selector: ${selector}`);
      break;
    }
  }

  // If no specific widget found, fail the test - we need actual widgets!
  if (!widget) {
    // Log the first 500 chars of HTML for debugging
    console.error('❌ No widget element found! Turn HTML preview:');
    console.error(turnHTML.substring(0, 500));
    throw new Error(
      `No widget element found with selectors: ${selectors.join(', ')}. ` +
      `A weather widget should have been rendered with data-widget-type or similar attribute.`
    );
  }

  // Wait for widget to be visible
  await expect(widget).toBeVisible({ timeout: TIMEOUTS.ASSISTANT_TURN });
  console.log(`✓ Widget is visible`);

  // If specific text is expected in the widget, verify it
  if (expectedWidget.expectText) {
    const widgetText = await widget.textContent();
    const regex = expectedWidget.expectText;
    if (!regex.test(widgetText || '')) {
      throw new Error(
        `Widget text did not match expected pattern. Expected: ${regex}, Got: ${widgetText?.substring(0, 200)}`
      );
    }
    console.log(`✓ Widget text matched: ${expectedWidget.expectText}`);
  }

  console.log(`✓ Widget ${expectedWidget.type} verified in UI`);
}

module.exports = {
  runConversationFlow,
  TIMEOUTS,
};
