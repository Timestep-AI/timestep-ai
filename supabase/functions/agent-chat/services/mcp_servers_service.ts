import { tool } from 'npm:@openai/agents-core';
import { Client } from 'npm:@modelcontextprotocol/sdk@^1.0.0/client/index.js';
import { StreamableHTTPClientTransport } from 'npm:@modelcontextprotocol/sdk@^1.0.0/client/streamableHttp.js';
import { McpServerRecord } from '../stores/mcp_servers_store.ts';
import { McpServersStore } from '../stores/mcp_servers_store.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export class McpServersService {
  private mcpServersStore: McpServersStore;

  constructor(
    private supabaseUrl: string,
    private anonKey: string,
    private userJwt: string
  ) {
    this.supabaseUrl = supabaseUrl;
    this.userJwt = userJwt;

    // Create Supabase client for store operations
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userJwt}`,
        },
      },
    });
    this.mcpServersStore = new McpServersStore(supabaseClient);
  }

  /**
   * Resolve a potentially relative URL to an absolute URL
   */
  resolveUrl(url: string): string {
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
   * Get tools from the database based on tool IDs
   * Tool IDs are in the format: "server-uuid.tool-name"
   */
  async getToolsFromDatabase(
    toolIds: string[],
    servers: McpServerRecord[]
  ): Promise<ReturnType<typeof tool>[]> {
    if (!toolIds || toolIds.length === 0) {
      console.warn('[McpServersService] No tool IDs specified, returning empty tools array');
      return [];
    }

    // Parse tool IDs to extract unique server IDs
    const serverToolMap = new Map<string, Set<string>>();
    for (const toolId of toolIds) {
      const [serverId, toolName] = toolId.split('.', 2);
      if (!serverId || !toolName) {
        console.warn(`[McpServersService] Invalid tool ID format: ${toolId}`);
        continue;
      }
      if (!serverToolMap.has(serverId)) {
        serverToolMap.set(serverId, new Set());
      }
      serverToolMap.get(serverId)!.add(toolName);
    }

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
      const mcpServerUrl = resolvedUrl;

      globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        // Check if this request is going to our MCP server or Supabase functions
        const shouldAddAuth =
          url.includes('/functions/v1/') ||
          url.includes('mcp-env') ||
          url.startsWith(mcpServerUrl) ||
          (this.supabaseUrl && url.includes(this.supabaseUrl.replace(/\/$/, '')));

        if (shouldAddAuth) {
          const headers = new Headers(init?.headers);
          if (!headers.has('Authorization') && this.userJwt) {
            console.log(`[McpServersService] Adding auth header to request: ${url}`);
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
            console.warn(`[McpServersService] Tool '${toolName}' not found in MCP server`);
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
              const mcpServerUrl = resolvedUrl;

              globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
                const url =
                  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

                // Check if this request is going to our MCP server or Supabase functions
                const shouldAddAuth =
                  url.includes('/functions/v1/') ||
                  url.includes('mcp-env') ||
                  url.startsWith(mcpServerUrl) ||
                  (this.supabaseUrl && url.includes(this.supabaseUrl.replace(/\/$/, '')));

                if (shouldAddAuth) {
                  const headers = new Headers(init?.headers);
                  if (!headers.has('Authorization') && userJwt) {
                    console.log(
                      `[McpServersService] Adding auth header to tool execution request: ${url}`
                    );
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
                console.error(`[McpServersService] Error executing MCP tool ${toolName}:`, error);
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
        console.error(`[McpServersService] Error creating tool wrapper for ${toolName}:`, error);
      }
    }

    return agentTools;
  }

  /**
   * Get MCP servers by their IDs
   */
  async getMcpServersByIds(serverIds: string[]): Promise<McpServerRecord[]> {
    return await this.mcpServersStore.getMcpServersByIds(serverIds);
  }

  /**
   * Create the default MCP server for a user if it doesn't exist
   */
  async createDefaultMcpServer(userId: string): Promise<void> {
    return await this.mcpServersStore.createDefaultMcpServer(userId);
  }
}
