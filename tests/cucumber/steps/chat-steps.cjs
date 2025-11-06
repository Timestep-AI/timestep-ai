const { Given, When, Then, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium, expect } = require('@playwright/test');
const { runConversationFlow } = require('../../helpers/conversation-flow.cjs');
const { themeSwitchingFlow } = require('../../helpers/theme-switching-flow.cjs');

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
// Backend Selection
// -----------------------------------------------------------------------------

Given('I select the {string} backend', async (backendName) => {
  console.log(`\n========== BACKEND SELECTION ==========`);
  await page.waitForLoadState('networkidle');

  // Click on the backend selector button
  await page.locator('ion-button#backend-selector-button').click();

  // Wait for the backend popover to be visible
  const backendPopover = page.locator('ion-popover[trigger="backend-selector-button"]');
  await backendPopover.waitFor({ state: 'visible', timeout: 15000 });

  // Wait for the backend name to appear in the popover content
  await backendPopover.locator(`ion-item:has-text("${backendName}")`).waitFor({ state: 'visible', timeout: 5000 });

  // Click on the backend name in the popover
  await backendPopover.getByText(backendName, { exact: true }).click();

  // Verify backend switch completed
  await expect(page.locator('ion-button#backend-selector-button')).toContainText(backendName, { timeout: 5000 });
  console.log(`✓ Verified active backend: ${backendName}`);

  // Wait for agents to load after backend switch
  await page.waitForResponse(
    (response) => response.url().includes('/agents') && response.status() === 200,
    { timeout: 10000 }
  ).catch(() => null);
});

// -----------------------------------------------------------------------------
// Agent Selection
// -----------------------------------------------------------------------------

Given('I open the chat for agent {string}', async (agentName) => {
  console.log(`\n========== SETUP ==========`);
  await page.waitForLoadState('networkidle');

  // Click on the agent selector button
  await page.locator('ion-button#agent-selector-button').click();
  
  // Wait for the agent popover to be visible
  const agentPopover = page.locator('ion-popover[trigger="agent-selector-button"]');
  await agentPopover.waitFor({ state: 'visible', timeout: 15000 });
  
  // Wait for the agent name to appear in the popover content
  await agentPopover.locator(`ion-item:has-text("${agentName}")`).waitFor({ state: 'visible', timeout: 10000 });
  
  // Click on the agent name in the popover
  await agentPopover.getByText(agentName, { exact: true }).click();

  // Verify agent context switch completed
  await expect(page.locator('ion-button#agent-selector-button')).toContainText(agentName, { timeout: 5000 });
  console.log(`✓ Verified active agent: ${agentName}`);

  // Wait for ChatKit iframe to load
  const iframe = page.locator('iframe[name="chatkit"]');
  await iframe.waitFor({ state: 'attached', timeout: 10000 });
  console.log('✓ ChatKit iframe loaded');

  // Wait for chat input to be ready
  const chatFrame = page.frameLocator('iframe[name="chatkit"]');
  const chatInput = chatFrame.locator('input[type="text"], textarea');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Chat input ready');

  // Check for Personal Assistant greeting
  if (agentName.includes('Personal')) {
    await expect(chatFrame.locator('h2')).toContainText('What can I help with today?', { timeout: 5000 });
    console.log('✓ Personal Assistant greeting visible');
  }
});

// -----------------------------------------------------------------------------
// Conversation Flow
// -----------------------------------------------------------------------------

When('I run the theme switching conversation flow', async () => {
  // Tool call verification is done by checking thread items from the API
  // This ensures the tool call actually occurred, not just that the assistant said it did
  await runConversationFlow(page, themeSwitchingFlow);
});

Then('the conversation should complete successfully', async () => {
  console.log('\n✅ All interactions completed successfully!');
});
