import { test, expect } from '@playwright/test';
import { cleanupOldTestData } from './helpers/db-helpers';
import { validateMathWeatherConversationFlow } from './helpers/conversation-test-helper';

test.beforeAll(async () => {
  await cleanupOldTestData();
});

test('Weather Assistant weather workflow end-to-end', async ({ page }) => {
  // ============================================================================
  // SETUP: Navigate and select Weather Assistant
  // ============================================================================
  console.log('\n========== SETUP ==========');
  await page.goto('/');
  await expect(page.locator('iframe[name="chatkit"]')).toBeVisible();
  await page.locator('ion-select').click();
  await page.waitForSelector('ion-popover', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(2000); // Wait for options to load
  await page.locator('ion-popover').getByText('Weather Assistant', { exact: true }).click();

  await page.waitForTimeout(5000); // Weather Assistant needs time to load
  const chatFrame = page.frameLocator('iframe[name="chatkit"]');
  await expect(chatFrame.locator('input[type="text"], textarea')).toBeVisible({ timeout: 10000 });

  // Run the complete math-weather conversation flow without handoffs
  await validateMathWeatherConversationFlow(page, false);

  console.log('\n✅ All interactions completed successfully!');
});
