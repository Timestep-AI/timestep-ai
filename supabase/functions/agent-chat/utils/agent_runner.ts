import { RunnerFactory } from './runner_factory.ts';
import type { Agent } from 'https://esm.sh/@openai/agents-core@0.0.1';

/**
 * ChatKit-agnostic agent execution utility.
 *
 * This module is responsible for executing agents and streaming their raw events.
 * It has ZERO knowledge of ChatKit formats, widgets, or UI concerns.
 *
 * The agent runner:
 * - Accepts either input items (for new runs) OR run state (for resuming)
 * - Executes the agent via RunnerFactory
 * - Returns raw agent events as-is
 * - Can be reused with any chat interface (Slack, Discord, etc.)
 */

export interface AgentRunConfig {
  threadId: string;
  userId: string;
  workflowName?: string;
}

export interface AgentRunResult {
  stream: AsyncIterable<unknown>;
  state: unknown;
}

/**
 * Runs an agent with either input items (new run) or run state (resume).
 *
 * @param agent - The agent to execute
 * @param inputOrState - Either an array of input items OR a RunState object (from agents-core)
 * @param config - Run configuration (thread ID, user ID, optional workflow name)
 * @returns Stream of raw agent events plus the run state
 */
export async function runAgent(
  agent: Agent,
  inputOrState: unknown[] | unknown,
  config: AgentRunConfig
): Promise<AgentRunResult> {
  const runner = await RunnerFactory.createRunner({
    threadId: config.threadId,
    userId: config.userId,
    ...(config.workflowName && { workflowName: config.workflowName }),
  });

  const result = await runner.run(agent, inputOrState, {
    context: { threadId: config.threadId, userId: config.userId },
    stream: true,
  });

  return {
    stream: result as AsyncIterable<unknown>,
    state: (result as { state: unknown }).state,
  };
}
