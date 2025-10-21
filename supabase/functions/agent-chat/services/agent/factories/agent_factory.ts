import { Agent } from '@openai/agents-core';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { AgentStore } from '../../../stores/agent_store.ts';
import { McpServerStore } from '../../../stores/mcp_server_store.ts';
import { McpService } from '../../mcp/service.ts';
import { AgentRecord } from '../../../types/agent.ts';

export class AgentFactory {
  private supabaseClient: SupabaseClient;
  private agentStore: AgentStore;
  private mcpServerStore: McpServerStore;
  private mcpService: McpService;

  constructor(
    private supabaseUrl: string,
    private anonKey: string,
    private userJwt: string
  ) {
    // Create Supabase client with user's JWT for RLS
    this.supabaseClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${this.userJwt}`,
        },
      },
    });

    this.agentStore = new AgentStore(this.supabaseClient);
    this.mcpServerStore = new McpServerStore(this.supabaseClient);
    this.mcpService = new McpService(supabaseUrl, userJwt);
  }

  async getAllAgents(userId: string): Promise<AgentRecord[]> {
    // Ensure default agents exist first
    await this.agentStore.ensureDefaultAgentsExist(userId);
    await this.mcpServerStore.createDefaultMcpServer(userId);

    // Fetch all agents for the user
    return await this.agentStore.getAllAgents(userId);
  }

  async createAgent(agentId: string, userId: string): Promise<Agent> {
    // Fetch agent configuration from database
    const agentData = await this.agentStore.getAgentById(agentId, userId);

    // If agent not found and it's a default agent ID, create it in the database
    if (!agentData && this.isDefaultAgentId(agentId)) {
      await this.agentStore.ensureDefaultAgentsExist(userId);
      await this.mcpServerStore.createDefaultMcpServer(userId);

      // Fetch the newly created agent - must match both id AND user_id for RLS
      const newAgentData = await this.agentStore.getAgentById(agentId, userId);

      if (!newAgentData) {
        console.error('[AgentFactory] Error fetching newly created agent:', agentId);
        throw new Error(`Failed to create default agent: ${agentId}`);
      }

      return this.buildAgentFromData(newAgentData, userId);
    } else if (!agentData) {
      console.error('[AgentFactory] Error fetching agent:', agentId);
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
          console.error(`[AgentFactory] Error loading handoff agent ${handoffId}:`, error);
          // Continue without this handoff if it fails to load
        }
      }
    }

    // Create the agent
    return new Agent({
      name: agentData.name,
      instructions: instructions,
      tools: tools,
      handoffs: handoffs,
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
    const servers = await this.mcpServerStore.getMcpServersByIds(Array.from(serverIds));

    if (!servers || servers.length === 0) {
      console.warn('[AgentFactory] No MCP servers found for the specified tool IDs');
      return [];
    }

    // Get tools from each server
    return await this.mcpService.getToolsFromDatabase(toolIds, servers);
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
