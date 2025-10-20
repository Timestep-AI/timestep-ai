// Agent Factory - Creates agents for the ChatKit server

import { Agent, tool } from '@openai/agents-core';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { Client } from 'npm:@modelcontextprotocol/sdk@^1.0.0/client/index.js';
import { StreamableHTTPClientTransport } from 'npm:@modelcontextprotocol/sdk@^1.0.0/client/streamableHttp.js';

interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  tool_ids: string[];
  handoff_ids: string[];
  created_at: string;
  updated_at: string;
}

interface McpServerRecord {
  id: string;
  user_id: string;
  name: string;
  url: string;
  auth_config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class AgentFactory {
  private supabaseClient: SupabaseClient;

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
  }

  async getAllAgents(userId: string): Promise<AgentRecord[]> {
    // Ensure default agents exist first
    await this.ensureDefaultAgentInDatabase(
      '00000000-0000-0000-0000-000000000000',
      userId,
      this.supabaseClient
    );
    await this.ensureDefaultAgentInDatabase(
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      userId,
      this.supabaseClient
    );

    // Fetch all agents for the user
    const { data: agents, error } = await this.supabaseClient
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[AgentFactory] Error fetching agents:', error);
      throw error;
    }

    return agents || [];
  }

  async createAgent(agentId: string, userId: string): Promise<Agent> {
    // Fetch agent configuration from database
    const { data: agentData, error: agentError } = await this.supabaseClient
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    // If agent not found and it's a default agent ID, create it in the database
    if ((agentError || !agentData) && this.isDefaultAgentId(agentId)) {
      await this.ensureDefaultAgentInDatabase(agentId, userId, this.supabaseClient);

      // Fetch the newly created agent - must match both id AND user_id for RLS
      const { data: newAgentData, error: newAgentError } = await this.supabaseClient
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', userId)
        .single();

      if (newAgentError || !newAgentData) {
        console.error('[AgentFactory] Error fetching newly created agent:', newAgentError);
        throw new Error(`Failed to create default agent: ${agentId}`);
      }

      return this.buildAgentFromData(newAgentData as AgentRecord, userId);
    } else if (agentError || !agentData) {
      console.error('[AgentFactory] Error fetching agent:', agentError);
      throw new Error(`Agent not found: ${agentId}`);
    }

    return this.buildAgentFromData(agentData as AgentRecord, userId);
  }

  private async buildAgentFromData(agentData: AgentRecord, userId: string): Promise<Agent> {
    // Build the agent configuration
    const instructions = agentData.instructions || 'You are a helpful AI assistant.';

    // Get MCP tools if tool_ids are specified
    const tools = await this.getToolsFromDatabase(agentData.tool_ids, this.supabaseClient);

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

  /**
   * Get tools from the database based on tool IDs
   * Tool IDs are in the format: "server-uuid.tool-name"
   */
  private async getToolsFromDatabase(
    toolIds: string[],
    supabase: SupabaseClient
  ): Promise<ReturnType<typeof tool>[]> {
    if (!toolIds || toolIds.length === 0) {
      console.warn('[AgentFactory] No tool IDs specified, returning empty tools array');
      return [];
    }

    // Parse tool IDs to extract unique server IDs
    const serverToolMap = new Map<string, Set<string>>();
    for (const toolId of toolIds) {
      const [serverId, toolName] = toolId.split('.', 2);
      if (!serverId || !toolName) {
        console.warn(`[AgentFactory] Invalid tool ID format: ${toolId}`);
        continue;
      }
      if (!serverToolMap.has(serverId)) {
        serverToolMap.set(serverId, new Set());
      }
      serverToolMap.get(serverId)!.add(toolName);
    }

    // Fetch MCP server configurations from database
    const serverIds = Array.from(serverToolMap.keys());
    const { data: serversData, error: serversError } = await supabase
      .from('mcp_servers')
      .select('*')
      .in('id', serverIds);

    if (serversError) {
      console.error('[AgentFactory] Error fetching MCP servers:', serversError);
      throw new Error('Failed to fetch MCP servers');
    }

    if (!serversData || serversData.length === 0) {
      console.warn('[AgentFactory] No MCP servers found for the specified tool IDs');
      return [];
    }

    const servers = serversData as McpServerRecord[];

    // Get tools from each server
    const allTools: ReturnType<typeof tool>[] = [];
    for (const server of servers) {
      const requestedTools = serverToolMap.get(server.id);
      if (!requestedTools) continue;

      const tools = await this.getMcpToolsFromServer(server.url, Array.from(requestedTools));
      allTools.push(...tools);
    }

    return allTools;
  }

  /**
   * Resolve a potentially relative URL to an absolute URL
   */
  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Relative URL - prepend SUPABASE_URL
    const baseUrl = this.supabaseUrl.endsWith('/')
      ? this.supabaseUrl.slice(0, -1)
      : this.supabaseUrl;
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${baseUrl}${path}`;
  }

  /**
   * Create tool wrappers for MCP tools
   */
  private async getMcpToolsFromServer(
    serverUrl: string,
    requestedToolNames: string[]
  ): Promise<ReturnType<typeof tool>[]> {
    // Resolve relative URLs
    const resolvedUrl = this.resolveUrl(serverUrl);

    const agentTools: ReturnType<typeof tool>[] = [];

    for (const toolName of requestedToolNames) {
      // Create a temporary client to fetch just this tool's schema
      const schemaClient = new Client({
        name: 'timestep-mcp-client',
        version: '1.0.0',
      });

      // Override fetch to add authorization
      const originalFetch = globalThis.fetch;
      const mcpServerHost = new URL(resolvedUrl).host;

      globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        if (url.includes(mcpServerHost)) {
          const headers = new Headers(init?.headers);
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${this.userJwt}`);
          }

          return originalFetch(input, {
            ...init,
            headers,
          });
        }

        return originalFetch(input, init);
      };

      try {
        const schemaTransport = new StreamableHTTPClientTransport(new URL(resolvedUrl));

        await schemaClient.connect(schemaTransport);

        try {
          // List tools to get the schema for this specific tool
          const { tools: mcpTools } = await schemaClient.listTools();
          const mcpTool = mcpTools.find((t) => t.name === toolName);

          if (!mcpTool) {
            console.warn(`[AgentFactory] Tool '${toolName}' not found in MCP server`);
            continue;
          }

          // Use the MCP JSON schema directly
          const jsonSchema = mcpTool.inputSchema as Record<string, unknown>;

          // Capture userJwt for use in execute function
          const userJwt = this.userJwt;

          const agentTool = tool({
            name: toolName,
            description: mcpTool.description || `MCP tool: ${toolName}`,
            parameters: jsonSchema,
            needsApproval: async () => {
              // Always require approval for MCP tools
              return true;
            },
            async execute(params: Record<string, unknown>) {
              // Create a new client for tool execution
              const execClient = new Client({
                name: 'timestep-mcp-client',
                version: '1.0.0',
              });

              // Override fetch for tool execution to add authorization
              const originalFetch = globalThis.fetch;
              const mcpServerHost = new URL(resolvedUrl).host;

              globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
                const url =
                  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

                if (url.includes(mcpServerHost)) {
                  const headers = new Headers(init?.headers);
                  if (!headers.has('Authorization')) {
                    headers.set('Authorization', `Bearer ${userJwt}`);
                  }

                  return originalFetch(input, {
                    ...init,
                    headers,
                  });
                }

                return originalFetch(input, init);
              };

              try {
                const execTransport = new StreamableHTTPClientTransport(new URL(resolvedUrl));

                await execClient.connect(execTransport);

                try {
                  const result = await execClient.callTool({
                    name: toolName,
                    arguments: params,
                  });

                  // Extract text content from result
                  const content = result.content || [];
                  const textContent = content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('\n');

                  return textContent || JSON.stringify(result);
                } finally {
                  await execClient.close();
                  // Restore original fetch
                  globalThis.fetch = originalFetch;
                }
              } catch (error) {
                // Restore original fetch on error
                globalThis.fetch = originalFetch;
                console.error(`[AgentFactory] Error executing MCP tool ${toolName}:`, error);
                throw error;
              }
            },
          });

          agentTools.push(agentTool);
        } finally {
          await schemaClient.close();
          // Restore original fetch
          globalThis.fetch = originalFetch;
        }
      } catch (error) {
        // Restore original fetch on error
        globalThis.fetch = originalFetch;
        console.error(`[AgentFactory] Error creating tool wrapper for ${toolName}:`, error);
      }
    }

    return agentTools;
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

  /**
   * Ensure a default agent exists in the database with its MCP server and dependencies
   */
  private async ensureDefaultAgentInDatabase(
    agentId: string,
    userId: string,
    supabase: SupabaseClient
  ): Promise<void> {
    // Check if agent already exists for this user
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (existingAgent) {
      return;
    }

    // Ensure default MCP server exists for this user
    await this.ensureDefaultMcpServer(userId, supabase);

    // Create agent based on the ID
    switch (agentId) {
      case '00000000-0000-0000-0000-000000000000': {
        // Personal Assistant (with think tool and handoff to Weather Assistant)
        const { error } = await supabase.from('agents').insert({
          id: agentId,
          user_id: userId,
          name: 'Personal Assistant',
          instructions: `# System context
You are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named \`transfer_to_<agent_name>\`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.
You are an AI agent acting as a personal assistant.`,
          tool_ids: ['00000000-0000-0000-0000-000000000000.think'],
          handoff_ids: ['ffffffff-ffff-ffff-ffff-ffffffffffff'],
        });

        if (error) {
          // Ignore duplicate key errors - it means another process created it
          if (error.code !== '23505') {
            console.error('[AgentFactory] Error creating default Personal Assistant:', error);
            throw new Error(`Failed to create default agent: ${error.message}`);
          }
        }
        break;
      }

      case 'ffffffff-ffff-ffff-ffff-ffffffffffff': {
        // Weather Assistant (with get_weather and think, no handoffs)
        const { error } = await supabase.from('agents').insert({
          id: agentId,
          user_id: userId,
          name: 'Weather Assistant',
          instructions:
            'You are a helpful AI assistant that can answer questions about weather. When asked about weather, you MUST use the get_weather tool to get accurate, real-time weather information.',
          tool_ids: [
            '00000000-0000-0000-0000-000000000000.get_weather',
            '00000000-0000-0000-0000-000000000000.think',
          ],
          handoff_ids: [],
        });

        if (error) {
          // Ignore duplicate key errors - it means another process created it
          if (error.code !== '23505') {
            console.error('[AgentFactory] Error creating default Weather Assistant:', error);
            throw new Error(`Failed to create default agent: ${error.message}`);
          }
        }
        break;
      }

      default:
        throw new Error(`Unknown default agent ID: ${agentId}`);
    }
  }

  /**
   * Ensure the default MCP server exists for the given user
   */
  private async ensureDefaultMcpServer(userId: string, supabase: SupabaseClient): Promise<void> {
    const defaultServerId = '00000000-0000-0000-0000-000000000000';

    // Check if it exists for this user
    const { data: existing } = await supabase
      .from('mcp_servers')
      .select('id')
      .eq('id', defaultServerId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return;
    }

    // Create it using the user's JWT (respects RLS)
    const { error } = await supabase.from('mcp_servers').insert({
      id: defaultServerId,
      user_id: userId,
      name: 'MCP Environment Server',
      url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-env/mcp`,
    });

    if (error) {
      // Ignore duplicate key errors - it means another process created it
      if (error.code === '23505') {
        return;
      }
      console.error('[AgentFactory] Error creating default MCP server:', error);
      throw new Error(`Failed to create default MCP server: ${error.message}`);
    }
  }
}
