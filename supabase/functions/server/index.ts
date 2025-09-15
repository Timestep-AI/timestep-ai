import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default agent data
const DEFAULT_AGENTS = [
  {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Personal Assistant',
    instructions: '# System context\nYou are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstraction: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named `transfer_to_<agent_name>`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.\nYou are an AI agent acting as a personal assistant.',
    handoffIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666'],
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: false,
  },
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Administrative Assistant',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'An administrative assistant that can manage administrative tasks on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Communications Coordinator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A communications coordinator that can manage communications on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Content Creator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A content creator that can create content on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Project Manager',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A project manager that can manage projects on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Research Assistant',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A research assistant that can research on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:26 PM',
    status: 'active',
    isHandoff: true,
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Scheduling Coordinator',
    instructions: 'You must always use the tools to answer questions.',
    handoffDescription: 'A scheduling coordinator that can schedule appointments on behalf of the user.',
    model: 'ollama/gpt-oss:20b',
    modelSettings: { temperature: 0.0 },
    createdAt: '8/31/2025, 3:06:27 PM',
    status: 'active',
    isHandoff: true,
  },
];

// In-memory storage for demo purposes
let agents = [...DEFAULT_AGENTS];
let nextId = 1000;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Route: GET /agents - Get all agents
    if (pathname === '/agents' && req.method === 'GET') {
      console.log('GET /agents - Returning all agents');
      return new Response(JSON.stringify(agents), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: GET /agents/:id - Get agent by ID
    if (pathname.startsWith('/agents/') && req.method === 'GET') {
      const id = pathname.split('/')[2];
      console.log(`GET /agents/${id} - Finding agent by ID`);
      
      const agent = agents.find(a => a.id === id);
      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify(agent), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: POST /agents - Create new agent
    if (pathname === '/agents' && req.method === 'POST') {
      const requestBody = await req.json();
      console.log('POST /agents - Creating new agent:', requestBody);
      
      const newAgent = {
        id: `agent-${nextId++}`,
        name: requestBody.name,
        description: requestBody.description,
        instructions: requestBody.instructions,
        handoffIds: requestBody.handoffIds || [],
        handoffDescription: requestBody.handoffDescription,
        model: requestBody.model,
        modelSettings: requestBody.modelSettings || {},
        status: requestBody.status || 'active',
        isHandoff: requestBody.isHandoff || false,
        createdAt: new Date().toLocaleString(),
      };

      agents.push(newAgent);
      
      return new Response(JSON.stringify(newAgent), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: PUT /agents/:id - Update agent
    if (pathname.startsWith('/agents/') && req.method === 'PUT') {
      const id = pathname.split('/')[2];
      const requestBody = await req.json();
      console.log(`PUT /agents/${id} - Updating agent:`, requestBody);
      
      const index = agents.findIndex(a => a.id === id);
      if (index === -1) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updatedAgent = { ...agents[index], ...requestBody };
      agents[index] = updatedAgent;
      
      return new Response(JSON.stringify(updatedAgent), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: DELETE /agents/:id - Delete agent
    if (pathname.startsWith('/agents/') && req.method === 'DELETE') {
      const id = pathname.split('/')[2];
      console.log(`DELETE /agents/${id} - Deleting agent`);
      
      const index = agents.findIndex(a => a.id === id);
      if (index === -1) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      agents.splice(index, 1);
      
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Route: DELETE /agents - Delete all agents
    if (pathname === '/agents' && req.method === 'DELETE') {
      console.log('DELETE /agents - Deleting all agents');
      agents = [];
      
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Route: POST /agents/defaults - Create default agents
    if (pathname === '/agents/defaults' && req.method === 'POST') {
      console.log('POST /agents/defaults - Creating default agents');
      
      agents = DEFAULT_AGENTS.map(agent => ({
        ...agent,
        createdAt: new Date().toLocaleString(),
      }));
      
      return new Response(JSON.stringify(agents), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: GET /agents/search?q=query - Search agents
    if (pathname === '/agents/search' && req.method === 'GET') {
      const query = url.searchParams.get('q') || '';
      console.log(`GET /agents/search?q=${query} - Searching agents`);
      
      if (!query.trim()) {
        return new Response(JSON.stringify(agents), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const lowercaseQuery = query.toLowerCase();
      const filtered = agents.filter(agent => 
        agent.name.toLowerCase().includes(lowercaseQuery) ||
        (agent.description && agent.description.toLowerCase().includes(lowercaseQuery))
      );
      
      return new Response(JSON.stringify(filtered), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route not found
    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in server function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});