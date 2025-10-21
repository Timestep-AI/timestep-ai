import { AgentService } from '../services/agent/service.ts';
import { MemoryStore } from '../stores/memory_store.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle agents API endpoint
export async function handleGetAgentsRequest(
  userId: string,
  authHeader: string
): Promise<Response> {
  try {
    // Extract just the JWT token from Authorization header (remove "Bearer " prefix)
    const userJwt = authHeader.replace('Bearer ', '');

    // Create a basic memory store for agent operations
    const store = new MemoryStore<{
      userId: string;
    }>(Deno.env.get('SUPABASE_URL') ?? '', userJwt, userId);

    const agentService = new AgentService(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      userJwt,
      store
    );

    // Get all agents for the user (this will create default agents if they don't exist)
    const agents = await agentService.getAllAgents(userId);

    return new Response(JSON.stringify(agents), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error handling agents request:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch agents' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
