import { test, expect } from '@playwright/test';
import { cleanupOldTestData } from './helpers/db-helpers';
import { validateMathWeatherConversationFlow } from './helpers/conversation-test-helper';

// Clean up old test data before running tests
test.beforeAll(async () => {
  await cleanupOldTestData();
});

test('Personal Assistant weather workflow end-to-end', async ({ page }) => {
  // ============================================================================
  // SETUP: Navigate and select Personal Assistant
  // ============================================================================
  console.log('\n========== SETUP ==========');
  await page.goto('/');
  await expect(page.locator('iframe[name="chatkit"]')).toBeVisible();
  await page.locator('ion-select').click();
  await page.waitForSelector('ion-popover', { state: 'visible', timeout: 5000 });
  await page.locator('ion-popover').getByText('Personal Assistant', { exact: true }).click();

  await page.waitForTimeout(3000);
  const chatFrame = page.frameLocator('iframe[name="chatkit"]');
  await expect(chatFrame.locator('input[type="text"], textarea')).toBeVisible({ timeout: 10000 });
  await expect(chatFrame.locator('h2')).toContainText('What can I help with today?');

  // Run the complete math-weather conversation flow with handoff validation
  await validateMathWeatherConversationFlow(page, true);

  console.log('\n✅ All interactions completed successfully!');
});
