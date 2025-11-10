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

      // If expectAssistantMustNotBeOnlyWidget is set, verify there's actual assistant text
      // separate from widget content
      if (step.expectAssistantMustNotBeOnlyWidget) {
        // Look for assistant message text that's NOT inside a widget
        const assistantTextElements = currentTurn.locator('p, div').filter({
          has: root.locator('text=/weather|temperature|forecast|currently/i')
        }).filter({
          hasNot: root.locator('[data-thread-item="widget"]')
        });

        const assistantTextCount = await assistantTextElements.count();
        if (assistantTextCount === 0) {
          // Fall back to checking if there's ANY text outside widgets
          const allText = await currentTurn.textContent();
          const widgetElements = currentTurn.locator('[data-thread-item="widget"]');
          const widgetCount = await widgetElements.count();

          let widgetText = '';
          for (let i = 0; i < widgetCount; i++) {
            widgetText += await widgetElements.nth(i).textContent();
          }

          // Remove widget text from total text to see if there's assistant message text
          const nonWidgetText = allText.replace(widgetText, '').trim();

          if (!nonWidgetText || nonWidgetText.length < 10) {
            throw new Error(
              `Expected assistant message with text separate from widgets, but found only widget content. ` +
              `Total text length: ${allText.length}, Widget text length: ${widgetText.length}, ` +
              `Non-widget text: "${nonWidgetText}"`
            );
          }
          console.log(`✓ Found assistant text separate from widgets: ${nonWidgetText.substring(0, 100)}...`);
        } else {
          console.log(`✓ Found ${assistantTextCount} assistant text element(s) outside widgets`);
        }
      }
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

    // --- Verify multiple widgets are displayed (if expected) ---
    if (step.expectWidgets) {
      await verifyMultipleWidgets(root, currentTurn, step.expectWidgets, false);
    }

    // --- Verify multiple widgets in any order (if expected) ---
    if (step.expectWidgetsUnordered) {
      await verifyMultipleWidgets(root, currentTurn, step.expectWidgetsUnordered, true);
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

async function verifyMultipleWidgets(root, currentTurn, expectedWidgets, allowAnyOrder = false) {
  const orderMsg = allowAnyOrder ? ' (any order)' : ' (strict order)';
  console.log(`→ Verifying ${expectedWidgets.length} widgets${orderMsg}`);

  // Wait a moment for widgets to render
  await currentTurn.page().waitForTimeout(1000);

  // Get the HTML structure for debugging
  const turnHTML = await currentTurn.innerHTML();
  console.log(`→ Turn HTML length: ${turnHTML.length} chars`);

  // The actual selector used by ChatKit is [data-thread-item="widget"]
  const widgetSelector = '[data-thread-item="widget"]';
  const widgets = currentTurn.locator(widgetSelector);
  const widgetCount = await widgets.count();

  console.log(`→ Found ${widgetCount} widget(s) with selector: ${widgetSelector}`);

  if (widgetCount === 0) {
    console.error('❌ No widget elements found! Turn HTML preview:');
    console.error(turnHTML.substring(0, 500));
    throw new Error(
      `No widget elements found. Expected ${expectedWidgets.length} widgets to be rendered.`
    );
  }

  if (widgetCount < expectedWidgets.length) {
    throw new Error(
      `Expected ${expectedWidgets.length} widgets but only found ${widgetCount}`
    );
  }

  if (allowAnyOrder) {
    // For unordered verification, collect all widget texts and match against expectations
    const widgetTexts = [];
    for (let i = 0; i < widgetCount; i++) {
      const widget = widgets.nth(i);
      await expect(widget).toBeVisible({ timeout: TIMEOUTS.ASSISTANT_TURN });
      const widgetText = await widget.textContent();
      widgetTexts.push(widgetText || '');
    }

    // Verify each expected widget is present somewhere
    for (const expectedWidget of expectedWidgets) {
      console.log(`→ Verifying presence of ${expectedWidget.type} widget`);

      let found = false;
      let matchedText = '';

      for (const widgetText of widgetTexts) {
        let matches = true;

        // Check expectText if specified
        if (expectedWidget.expectText) {
          const regex = expectedWidget.expectText;
          if (!regex.test(widgetText)) {
            matches = false;
          }
        }

        // Check mustContain if specified
        if (expectedWidget.mustContain) {
          if (!widgetText.includes(expectedWidget.mustContain)) {
            matches = false;
          }
        }

        if (matches) {
          found = true;
          matchedText = widgetText.substring(0, 100).replace(/\s+/g, ' ');
          break;
        }
      }

      if (!found) {
        throw new Error(
          `Expected widget with type="${expectedWidget.type}", ` +
          `expectText=${expectedWidget.expectText}, ` +
          `mustContain="${expectedWidget.mustContain}" not found`
        );
      }

      console.log(`✓ Found ${expectedWidget.type} widget: ${matchedText}...`);
    }

    console.log(`✓ All ${expectedWidgets.length} widgets verified (any order)`);
  } else {
    // Strict order verification (original behavior)
    for (let i = 0; i < expectedWidgets.length; i++) {
      const expectedWidget = expectedWidgets[i];
      console.log(`→ Verifying widget ${i + 1}/${expectedWidgets.length}: ${expectedWidget.type}`);

      const widget = widgets.nth(i);

      // Wait for widget to be visible
      await expect(widget).toBeVisible({ timeout: TIMEOUTS.ASSISTANT_TURN });

      // Get widget text for debugging
      const widgetText = await widget.textContent();
      const preview = widgetText?.substring(0, 100).replace(/\s+/g, ' ');
      console.log(`✓ Widget ${i + 1} is visible - preview: ${preview}...`);

      // If specific text is expected in the widget, verify it
      if (expectedWidget.expectText) {
        const regex = expectedWidget.expectText;
        if (!regex.test(widgetText || '')) {
          throw new Error(
            `Widget ${i + 1} text did not match expected pattern. Expected: ${regex}, Got: ${widgetText?.substring(0, 200)}`
          );
        }
        console.log(`✓ Widget ${i + 1} text matched: ${expectedWidget.expectText}`);
      }

      // If mustContain is specified, verify it strictly
      if (expectedWidget.mustContain) {
        const mustContain = expectedWidget.mustContain;
        if (!widgetText?.includes(mustContain)) {
          throw new Error(
            `Widget ${i + 1} must contain "${mustContain}" but got: ${widgetText?.substring(0, 200)}`
          );
        }
        console.log(`✓ Widget ${i + 1} strictly contains: ${mustContain}`);
      }
    }

    console.log(`✓ All ${expectedWidgets.length} widgets verified in order`);
  }
}

module.exports = {
  runConversationFlow,
  TIMEOUTS,
};
