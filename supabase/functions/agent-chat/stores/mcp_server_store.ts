import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface McpServerRecord {
  id: string;
  user_id: string;
  name: string;
  url: string;
  auth_config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class McpServerStore {
  constructor(private supabaseClient: SupabaseClient) {}

  async getMcpServersByIds(serverIds: string[]): Promise<McpServerRecord[]> {
    const { data: serversData, error } = await this.supabaseClient
      .from('mcp_servers')
      .select('*')
      .in('id', serverIds);

    if (error) {
      console.error('[McpServerRepository] Error fetching MCP servers:', error);
      throw new Error('Failed to fetch MCP servers');
    }

    return serversData as McpServerRecord[];
  }

  async getMcpServerById(serverId: string, userId: string): Promise<McpServerRecord | null> {
    const { data: serverData, error } = await this.supabaseClient
      .from('mcp_servers')
      .select('*')
      .eq('id', serverId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[McpServerRepository] Error fetching MCP server:', error);
      throw error;
    }

    return serverData as McpServerRecord;
  }

  async createDefaultMcpServer(userId: string): Promise<void> {
    const defaultServerId = '00000000-0000-0000-0000-000000000000';

    // Check if it exists for this user
    const existing = await this.getMcpServerById(defaultServerId, userId);

    if (existing) {
      return;
    }

    // Create it using the user's JWT (respects RLS)
    const { error } = await this.supabaseClient.from('mcp_servers').insert({
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
      console.error('[McpServerRepository] Error creating default MCP server:', error);
      throw new Error(`Failed to create default MCP server: ${error.message}`);
    }
  }
}
