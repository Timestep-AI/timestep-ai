import { AgentFactory } from '../services/agent_service.ts'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle agents API endpoint
export async function handleAgentsRequest(userId: string, authHeader: string): Promise<Response> {
  try {
    console.log('Agents API request for user:', userId);
    
    // Extract just the JWT token from Authorization header (remove "Bearer " prefix)
    const userJwt = authHeader.replace('Bearer ', '');
    
    const agentFactory = new AgentFactory(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      userJwt
    );
    
    // Get all agents for the user (this will create default agents if they don't exist)
    const agents = await agentFactory.getAllAgents(userId);
    
    return new Response(
      JSON.stringify(agents),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error handling agents request:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch agents' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
