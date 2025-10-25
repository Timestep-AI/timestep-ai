const { Given, When, Then, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium, expect } = require('@playwright/test');
const { runConversationFlow } = require('../../helpers/conversation-flow.cjs');
const {
  personalAssistantFlow,
  weatherAssistantFlow,
} = require('../../helpers/math-weather-flow.cjs');

// Set default timeout to 60 seconds for all steps
setDefaultTimeout(60000);

let browser;
let page;

// Each scenario runs in isolation
Before(async () => {
  browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  page = await context.newPage();
});

After(async () => {
  await browser.close();
});

// -----------------------------------------------------------------------------
// Anonymous User Setup
// -----------------------------------------------------------------------------

Given('I am a new anonymous user', async () => {
  await page.goto('http://localhost:8080');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  // Wait for Supabase anonymous auth (optional)
  await page
    .waitForFunction(
      () => {
        return !!Object.keys(localStorage).find(
          (k) => k.includes('sb-') && k.includes('-auth-token')
        );
      },
      { timeout: 20000 }
    )
    .catch(() => console.log('⚠️ Skipped Supabase auth check'));

  console.log('✓ Fresh anonymous user context established');
});

// -----------------------------------------------------------------------------
// Agent Selection
// -----------------------------------------------------------------------------

Given('I open the chat for agent {string}', async (agentName) => {
  console.log(`\n========== SETUP ==========`);
  await page.waitForLoadState('networkidle');

  // Wait for the page to be fully loaded
  await page.waitForTimeout(2000);

  await page.locator('ion-select').click();
  await page.waitForSelector('ion-popover', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.locator('ion-popover').getByText(agentName, { exact: true }).click();

  // 🔸 CRITICAL: Verify agent context switch completed
  await page.waitForTimeout(500); // Allow context remount
  const selectedAgent = await page.locator('ion-select').textContent();
  if (!selectedAgent?.includes(agentName)) {
    throw new Error(
      `Agent context verification failed: expected "${agentName}" but got "${selectedAgent}"`
    );
  }
  console.log(`✓ Verified active agent: ${agentName}`);

  // 🔸 CRITICAL: Wait for ChatKit to fully initialize after agent switch
  console.log('⏳ Waiting for ChatKit to initialize with new agent...');
  await page.waitForTimeout(3000); // Give ChatKit time to initialize

  // Check if page is blank/white
  const bodyText = await page.locator('body').textContent();
  if (!bodyText || bodyText.trim().length < 10) {
    console.log('⚠️  Page appears to be blank, waiting longer for ChatKit...');
    await page.waitForTimeout(5000);
  }

  // 🔸 CRITICAL: Verify ChatKit iframe is loaded (URL routing is handled in fetch interceptor)
  const iframe = page.locator('iframe[name="chatkit"]');
  if ((await iframe.count()) > 0) {
    const iframeSrc = await iframe.getAttribute('src');
    console.log(`Debug: ChatKit iframe src: ${iframeSrc}`);
    console.log('✓ ChatKit iframe loaded (requests will be routed dynamically)');
  } else {
    console.log('⚠️  No ChatKit iframe found after agent switch');
  }

  await page.waitForTimeout(5000);

  // Wait for chat interface to be ready (ChatKit renders in main DOM)
  // Debug: Check what elements are available
  const inputElements = await page.locator('input').count();
  const textareaElements = await page.locator('textarea').count();
  const allInputs = await page.locator('input, textarea').count();
  console.log(
    `Debug: Found ${inputElements} inputs, ${textareaElements} textareas, ${allInputs} total input elements`
  );

  // Check input types
  for (let i = 0; i < inputElements; i++) {
    const input = page.locator('input').nth(i);
    const type = await input.getAttribute('type');
    const placeholder = await input.getAttribute('placeholder');
    console.log(`Input ${i}: type="${type}", placeholder="${placeholder}"`);
  }

  // Check for contenteditable elements or other input-like elements
  const contentEditableElements = await page.locator('[contenteditable]').count();
  const divInputs = await page.locator('div[role="textbox"]').count();
  console.log(
    `Debug: Found ${contentEditableElements} contenteditable elements, ${divInputs} div textboxes`
  );

  // Check for iframes to understand the current DOM structure
  const iframes = await page.locator('iframe').count();
  console.log(`Debug: Found ${iframes} iframes`);

  if (iframes > 0) {
    for (let i = 0; i < iframes; i++) {
      const iframe = page.locator('iframe').nth(i);
      const name = await iframe.getAttribute('name');
      const src = await iframe.getAttribute('src');
      console.log(`Iframe ${i}: name="${name}", src="${src}"`);
    }
  }

  // Since ChatKit is currently in iframe, we need to wait for iframe to load
  // This is a test-level synchronization issue, not an app issue
  if (iframes > 0) {
    await expect(page.locator('iframe[name="chatkit"]')).toBeVisible({ timeout: 30000 });
    console.log('✓ ChatKit iframe loaded');

    // Wait for iframe content to be ready (longer timeout for agent switching)
    const chatFrame = page.frameLocator('iframe[name="chatkit"]');
    await expect(chatFrame.locator('input[type="text"], textarea')).toBeVisible({ timeout: 60000 });
    console.log('✓ Chat input ready in iframe');
  } else {
    // This is the expected behavior per directive
    const chatInputSelectors = [
      'input[type="text"]',
      'textarea',
      '[contenteditable]',
      'div[role="textbox"]',
      'input:not([type="hidden"]):not([type="checkbox"])',
    ];

    let chatInputFound = false;
    for (const selector of chatInputSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✓ Found chat input with selector: ${selector} (${count} elements)`);
        await expect(page.locator(selector).first()).toBeVisible({ timeout: 10000 });
        chatInputFound = true;
        break;
      }
    }

    if (!chatInputFound) {
      throw new Error('No chat input element found with any selector');
    }

    console.log('✓ Chat interface ready in main DOM');
  }

  if (agentName.includes('Personal')) {
    // Check for Personal Assistant greeting
    if (iframes > 0) {
      const chatFrame = page.frameLocator('iframe[name="chatkit"]');
      await expect(chatFrame.locator('h2')).toContainText('What can I help with today?');
    } else {
      await expect(page.locator('h2')).toContainText('What can I help with today?');
    }
    console.log('✓ Personal Assistant greeting visible');
  } else if (agentName.includes('Weather')) {
    // 🔸 CRITICAL: Weather Assistant should never show handoffs
    // Check that no handoff messages are present in the initial state
    const root = iframes > 0 ? page.frameLocator('iframe[name="chatkit"]') : page;
    const existingMessages = root.locator('article[data-thread-turn="assistant"]');
    const messageCount = await existingMessages.count();

    if (messageCount > 0) {
      for (let i = 0; i < messageCount; i++) {
        const message = existingMessages.nth(i);
        const text = await message.textContent();
        if (text?.includes('Transferring to') || text?.includes('handoff')) {
          throw new Error(`Weather Assistant incorrectly showing handoff: "${text}"`);
        }
      }
    }
    console.log('✓ Verified Weather Assistant has no handoff messages');
  }
});

// -----------------------------------------------------------------------------
// Conversation Flow
// -----------------------------------------------------------------------------

When('I run the math-weather conversation flow', async () => {
  // Determine which flow to use based on the current agent
  const currentAgent = await page.locator('ion-select').textContent();
  const flow = currentAgent?.includes('Personal') ? personalAssistantFlow : weatherAssistantFlow;
  await runConversationFlow(page, flow);
});

Then('the conversation should complete successfully', async () => {
  console.log('\n✅ All interactions completed successfully!');
});
