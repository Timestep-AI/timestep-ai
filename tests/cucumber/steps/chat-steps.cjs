const { Given, When, Then, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium, expect } = require('@playwright/test');
const { runConversationFlow } = require('../../helpers/conversation-flow.cjs');
const { themeSwitchingFlow } = require('../../helpers/theme-switching-flow.cjs');
const { weatherFlow } = require('../../helpers/weather-flow.cjs');
const { crossBackendApprovalFlowTS, crossBackendApprovalFlowPython } = require('../../helpers/cross-backend-approval-flow.cjs');

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

  // Click on the settings button to open the settings menu
  // The settings button is the first button with icon-only class in the toolbar
  const settingsButton = page.locator('ion-toolbar ion-buttons[slot="start"] ion-button.button-has-icon-only').first();
  await settingsButton.waitFor({ state: 'visible', timeout: 10000 });
  await settingsButton.click();

  // Wait for the settings menu to be visible
  const settingsMenu = page.locator('ion-menu#left-menu');
  await settingsMenu.waitFor({ state: 'visible', timeout: 15000 });

  // Find the backend select dropdown in the settings menu
  // The select is in an item with "Backend" label
  const backendSelectItem = settingsMenu.locator('ion-item').filter({ hasText: 'Backend' });
  await backendSelectItem.waitFor({ state: 'visible', timeout: 5000 });
  
  const backendSelect = backendSelectItem.locator('ion-select');
  await backendSelect.waitFor({ state: 'visible', timeout: 5000 });

  // Click on the ion-select element to open the popover
  // Ionic select with interface="popover" opens a popover when clicked
  await backendSelect.click();

  // Wait for the select popover to be visible
  // The select popover has class "select-popover" to distinguish it from other popovers
  const popover = page.locator('ion-popover.select-popover');
  await popover.waitFor({ state: 'visible', timeout: 5000 });
  
  // Wait for the backend item to be visible in the popover (instead of arbitrary timeout)
  const backendItem = popover.locator('ion-item').filter({ hasText: new RegExp(`^${backendName}$`, 'i') });
  await backendItem.waitFor({ state: 'visible', timeout: 5000 });
  await backendItem.click();

  // Wait for the select value to update (instead of arbitrary timeout)
  await expect(backendSelect).toHaveAttribute('value', backendName.toLowerCase(), { timeout: 5000 });
  console.log(`✓ Verified active backend: ${backendName}`);

  // Close the settings menu
  await settingsMenu.evaluate((menu) => menu.close());
  await settingsMenu.waitFor({ state: 'hidden', timeout: 5000 });

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

When('I run the weather conversation flow', async () => {
  // Tool call verification is done by checking thread items from the API
  // This ensures the tool call actually occurred, not just that the assistant said it did
  await runConversationFlow(page, weatherFlow);
});

When('I run the cross-backend approval flow starting with TypeScript', async () => {
  // Test run state compatibility: start with TypeScript, switch to Python for approval
  await runConversationFlow(page, crossBackendApprovalFlowTS);
});

When('I run the cross-backend approval flow starting with Python', async () => {
  // Test run state compatibility: start with Python, switch to TypeScript for approval
  await runConversationFlow(page, crossBackendApprovalFlowPython);
});

Then('the conversation should complete successfully', async () => {
  console.log('\n✅ All interactions completed successfully!');
});
