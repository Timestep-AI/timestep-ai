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
  TOOL_RENDER: 30000,
  TOOL_RESULT: 30000,
  UI_SETTLE: 1000,
  ASSISTANT_TURN: 30000,
  SUMMARY: 20000,
  SEND_BUTTON: 10000,
  CONTEXT_REMOUNT: 500,
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

    // --- Optional agent switch ---
    if (step.switchAgentTo) {
      console.log(`→ Switching to agent: ${step.switchAgentTo}`);
      const agentButton = page.getByRole('button', { name: new RegExp(step.switchAgentTo, 'i') });
      await agentButton.click();
      const header = page.locator('header, [data-active-agent]');
      await expect(header).toContainText(new RegExp(step.switchAgentTo, 'i'), { timeout: 5000 });
      await page.waitForTimeout(TIMEOUTS.CONTEXT_REMOUNT);
      console.log(`✓ Verified active agent: ${step.switchAgentTo}`);
    }

    await input.fill(step.user);
    await sendButton.click();

    // --- Wait for new assistant message ---
    const newIndex = await waitForNextAssistantTurn(assistantTurns, prevCount);
    prevCount = newIndex + 1;
    const currentTurn = assistantTurns.nth(newIndex);

    // --- Behavioral check: no unexpected handoffs when Weather Assistant active ---
    if (step.switchAgentTo?.match(/Weather/i)) {
      await expect(currentTurn).not.toContainText(/Transferring to/i);
      console.log('✓ Verified no unexpected handoff from Weather Assistant');
    }

    if (step.expectAssistant) {
      await expect
        .poll(async () => (await currentTurn.textContent()) || '')
        .toMatch(step.expectAssistant);
      console.log(`✓ Assistant matched: ${step.expectAssistant}`);
    }

    if (step.approvals?.length) {
      await handleToolApprovals(root, page, assistantTurns, currentTurn, step.approvals);
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

async function handleToolApprovals(
  root,
  page,
  assistantTurns,
  currentTurn,
  approvals
) {
  console.log(`→ Expecting ${approvals.length} tool approvals...`);

  const anyApproval = assistantTurns.filter({ hasText: /Tool approval required/i });
  await expect(anyApproval.first(), 'Waiting for at least one tool approval to render').toBeVisible(
    { timeout: TIMEOUTS.TOOL_RENDER }
  );
  console.log('✓ At least one tool approval prompt has appeared');

  await root.waitForTimeout?.(TIMEOUTS.UI_SETTLE) || await page.waitForTimeout(TIMEOUTS.UI_SETTLE);

  for (const [index, city] of approvals.entries()) {
    const approvalPrompt = new RegExp(`Tool approval required.*get_weather.*${city}`, 'i');
    const approvalNode = assistantTurns.filter({ hasText: approvalPrompt });
    await expect(approvalNode, `Missing approval prompt for ${city}`).toBeVisible({
      timeout: TIMEOUTS.SUMMARY,
    });
    console.log(`✓ Approval prompt visible for ${city}`);

    const before = (await approvalNode.first().textContent()) || '';

    const approveButton = approvalNode.locator('button:has-text("Approve")').nth(index);
    await expect(approveButton, `Approve button for ${city} not found`).toBeVisible({
      timeout: TIMEOUTS.SUMMARY,
    });
    await approveButton.click();
    console.log(`  Clicked Approve for ${city}`);

    const resultPattern = new RegExp(`Tool Result.*get_weather.*${city}`, 'i');
    await expect
      .poll(async () => (await approvalNode.first().textContent()) || '', {
        message: `Waiting for Tool Result for ${city}`,
        timeout: TIMEOUTS.TOOL_RESULT,
      })
      .not.toBe(before);
    await expect(approvalNode.first()).toContainText(resultPattern);
    console.log(`✓ Tool result streamed in for ${city}`);
  }

  const finalSummary = assistantTurns.last();
  await expect
    .poll(async () => (await finalSummary.textContent()) || '', {
      message: 'Waiting for final assistant summary',
      timeout: TIMEOUTS.SUMMARY,
    })
    .toMatch(new RegExp(approvals.join('.*'), 'i'));
  console.log(`✓ Final summary confirmed for ${approvals.join(', ')}`);
}

module.exports = {
  runConversationFlow,
  TIMEOUTS,
};
