import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { ModelSettings } from '@openai/agents-core';

export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  tool_ids: string[];
  handoff_ids: string[];
  model: string;
  model_settings: ModelSettings;
  created_at: string;
  updated_at: string;
}

export class AgentsStore {
  constructor(private supabaseClient: SupabaseClient) {}

  async getAllAgents(userId: string): Promise<AgentRecord[]> {
    const { data: agents, error } = await this.supabaseClient
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[AgentRepository] Error fetching agents:', error);
      throw error;
    }

    return agents || [];
  }

  async getAgentById(agentId: string, userId: string): Promise<AgentRecord | null> {
    const { data: agentData, error } = await this.supabaseClient
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[AgentRepository] Error fetching agent:', error);
      throw error;
    }

    return agentData as AgentRecord;
  }

  async createDefaultAgent(
    agentId: string,
    userId: string,
    name: string,
    instructions: string,
    toolIds: string[],
    handoffIds: string[],
    model: string = Deno.env.get('DEFAULT_AGENT_MODEL')!,
    modelSettings: ModelSettings = {}
  ): Promise<void> {
    const { error } = await this.supabaseClient.from('agents').insert({
      id: agentId,
      user_id: userId,
      name,
      instructions,
      tool_ids: toolIds,
      handoff_ids: handoffIds,
      model,
      model_settings: modelSettings,
    });

    if (error) {
      // Ignore duplicate key errors - it means another process created it
      if (error.code !== '23505') {
        console.error('[AgentRepository] Error creating default agent:', error);
        throw new Error(`Failed to create default agent: ${error.message}`);
      }
    }
  }

  async ensureDefaultAgentsExist(userId: string): Promise<void> {
    // Ensure default agents exist first
    await this.ensureDefaultAgentInDatabase(
      '00000000-0000-0000-0000-000000000000',
      userId,
      'Personal Assistant',
      `# System context
You are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named \`transfer_to_<agent_name>\`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.
You are an AI agent acting as a personal assistant.`,
      ['00000000-0000-0000-0000-000000000000.think'],
      ['ffffffff-ffff-ffff-ffff-ffffffffffff']
    );

    await this.ensureDefaultAgentInDatabase(
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      userId,
      'Weather Assistant',
      'You are a helpful AI assistant that can answer questions about weather. When asked about weather, you MUST use the get_weather tool to get accurate, real-time weather information.',
      [
        '00000000-0000-0000-0000-000000000000.get_weather',
        '00000000-0000-0000-0000-000000000000.think',
      ],
      []
    );
  }

  private async ensureDefaultAgentInDatabase(
    agentId: string,
    userId: string,
    name: string,
    instructions: string,
    toolIds: string[],
    handoffIds: string[],
    model: string = Deno.env.get('DEFAULT_AGENT_MODEL')!,
    modelSettings: ModelSettings = {}
  ): Promise<void> {
    // Check if agent already exists for this user
    const existingAgent = await this.getAgentById(agentId, userId);

    if (existingAgent) {
      return;
    }

    await this.createDefaultAgent(
      agentId,
      userId,
      name,
      instructions,
      toolIds,
      handoffIds,
      model,
      modelSettings
    );
  }
}
