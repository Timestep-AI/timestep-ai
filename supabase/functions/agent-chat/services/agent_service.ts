import { Agent } from '@openai/agents-core';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { AgentRecord } from '../stores/agent_store.ts';
import { ThreadStore } from '../stores/thread_store.ts';
import { AgentStore } from '../stores/agent_store.ts';
import { McpServerService } from './mcp_server_service.ts';

export class AgentsService {
  private supabaseClient: SupabaseClient;
  private AgentStore: AgentStore;
  private McpServerService: McpServerService;
  private ThreadStore: ThreadStore;

  constructor(supabaseUrl: string, anonKey: string, userJwt: string, ThreadStore: ThreadStore) {
    // Create Supabase client with user's JWT for RLS
    this.supabaseClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userJwt}`,
        },
      },
    });

    this.AgentStore = new AgentStore(this.supabaseClient);
    this.McpServerService = new McpServerService(supabaseUrl, anonKey, userJwt);
    this.ThreadStore = ThreadStore;
  }

  /**
   * Get all agents for a user, ensuring default agents exist
   */
  async getAllAgents(userId: string): Promise<AgentRecord[]> {
    // Ensure default agents exist first
    await this.AgentStore.ensureDefaultAgentsExist(userId);
    await this.McpServerService.createDefaultMcpServer(userId);

    // Fetch all agents for the user
    return await this.AgentStore.getAllAgents(userId);
  }

  /**
   * Create an agent instance by ID
   */
  async createAgent(agentId: string, userId: string): Promise<Agent> {
    // Fetch agent configuration from database
    const agentData = await this.AgentStore.getAgentById(agentId, userId);

    // If agent not found and it's a default agent ID, create it in the database
    if (!agentData && this.isDefaultAgentId(agentId)) {
      await this.AgentStore.ensureDefaultAgentsExist(userId);
      await this.McpServerService.createDefaultMcpServer(userId);

      // Fetch the newly created agent - must match both id AND user_id for RLS
      const newAgentData = await this.AgentStore.getAgentById(agentId, userId);

      if (!newAgentData) {
        console.error('[AgentsService] Error fetching newly created agent:', agentId);
        throw new Error(`Failed to create default agent: ${agentId}`);
      }

      return this.buildAgentFromData(newAgentData, userId);
    } else if (!agentData) {
      console.error('[AgentsService] Error fetching agent:', agentId);
      throw new Error(`Agent not found: ${agentId}`);
    }

    return this.buildAgentFromData(agentData, userId);
  }

  private async buildAgentFromData(agentData: AgentRecord, userId: string): Promise<Agent> {
    // Build the agent configuration
    const instructions = agentData.instructions || 'You are a helpful AI assistant.';

    // Get MCP tools if tool_ids are specified
    const tools = await this.getToolsFromDatabase(agentData.tool_ids);

    // Recursively load handoff agents
    const handoffs: Agent[] = [];
    if (agentData.handoff_ids && agentData.handoff_ids.length > 0) {
      for (const handoffId of agentData.handoff_ids) {
        try {
          const handoffAgent = await this.createAgent(handoffId, userId);
          handoffs.push(handoffAgent);
        } catch (error) {
          console.error(`[AgentsService] Error loading handoff agent ${handoffId}:`, error);
          // Continue without this handoff if it fails to load
        }
      }
    }

    // Apply default model settings if none are specified
    const defaultModelSettings = { temperature: 0.0, toolChoice: 'auto' };
    const modelSettings =
      agentData.model_settings && Object.keys(agentData.model_settings).length > 0
        ? agentData.model_settings
        : defaultModelSettings;

    // Create the agent
    return new Agent({
      name: agentData.name,
      instructions: instructions,
      tools: tools,
      handoffs: handoffs,
      model: agentData.model,
      modelSettings: modelSettings,
    });
  }

  private async getToolsFromDatabase(toolIds: string[]): Promise<any[]> {
    if (!toolIds || toolIds.length === 0) {
      return [];
    }

    // Parse tool IDs to extract unique server IDs
    const serverIds = new Set<string>();
    for (const toolId of toolIds) {
      const [serverId] = toolId.split('.', 2);
      if (serverId) {
        serverIds.add(serverId);
      }
    }

    // Fetch MCP server configurations from database
    const servers = await this.McpServerService.getMcpServersByIds(Array.from(serverIds));

    if (!servers || servers.length === 0) {
      console.warn('[AgentsService] No MCP servers found for the specified tool IDs');
      return [];
    }

    // Get tools from each server
    return await this.McpServerService.getToolsFromDatabase(toolIds, servers);
  }

  /**
   * Check if an agent ID is a default/well-known agent
   */
  private isDefaultAgentId(agentId: string): boolean {
    const DEFAULT_AGENT_IDS = [
      '00000000-0000-0000-0000-000000000000', // Default Personal Assistant (with think tool)
      'ffffffff-ffff-ffff-ffff-ffffffffffff', // Default Weather Assistant (with get_weather and think)
    ];
    return DEFAULT_AGENT_IDS.includes(agentId);
  }
}
