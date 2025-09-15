import "https://deno.land/x/xhr@0.1.0/mod.ts";
import * as timestep from 'npm:@timestep-ai/timestep@2025.9.151542';
import { getTimestepPaths } from "./utils.ts";
import { listModels } from "./api/modelsApi.ts";
import { listContexts } from "./api/contextsApi.ts";
import { listApiKeys } from "./api/settings/apiKeysApi.ts";
import { listMcpServers } from "./api/settings/mcpServersApi.ts";
import { listTraces } from "./api/tracesApi.ts";
import { listTools } from "./api/toolsApi.ts";

// Default agent data - kept for backwards compatibility
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

// Get timestep configuration paths
const timestepPaths = getTimestepPaths();

// Start CLI endpoints server for the React CLI
const cliPort = 3000;
console.log(`🌐 Starting CLI endpoints server on port ${cliPort}`);

Deno.serve({ port: cliPort }, async (req: Request) => {
  const url = new URL(req.url);

  // Add CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    // Legacy agents endpoints - maintain exact same functionality
    if (url.pathname === "/server/agents") {
      if (req.method === "GET") {
        // Check for search query
        const query = url.searchParams.get('q');
        if (query) {
          console.log(`GET /server/agents/search?q=${query} - Searching agents`);
          const lowercaseQuery = query.toLowerCase();
          const filtered = agents.filter(agent => 
            agent.name.toLowerCase().includes(lowercaseQuery) ||
            (agent.description && agent.description.toLowerCase().includes(lowercaseQuery))
          );
          return new Response(JSON.stringify(filtered), { status: 200, headers });
        }
        
        console.log('GET /server/agents - Returning all agents, count:', agents.length);
        return new Response(JSON.stringify(agents), { status: 200, headers });
      }
      
      if (req.method === "POST") {
        const requestBody = await req.json();
        console.log('POST /server/agents - Creating new agent:', requestBody);
        
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
        return new Response(JSON.stringify(newAgent), { status: 201, headers });
      }
      
      if (req.method === "DELETE") {
        console.log('DELETE /server/agents - Deleting all agents');
        agents = [];
        return new Response(null, { status: 204, headers });
      }
    }

    // Handle agent by ID endpoints
    const agentIdMatch = url.pathname.match(/^\/server\/agents\/([^\/]+)$/);
    if (agentIdMatch) {
      const id = agentIdMatch[1];
      
      if (req.method === "GET") {
        console.log(`GET /server/agents/${id} - Finding agent by ID`);
        const agent = agents.find(a => a.id === id);
        
        if (!agent) {
          return new Response(JSON.stringify({ error: 'Agent not found' }), { 
            status: 404, 
            headers 
          });
        }
        
        return new Response(JSON.stringify(agent), { status: 200, headers });
      }
      
      if (req.method === "PUT") {
        const requestBody = await req.json();
        console.log(`PUT /server/agents/${id} - Updating agent:`, requestBody);
        
        const index = agents.findIndex(a => a.id === id);
        if (index === -1) {
          return new Response(JSON.stringify({ error: 'Agent not found' }), { 
            status: 404, 
            headers 
          });
        }

        const updatedAgent = { ...agents[index], ...requestBody };
        agents[index] = updatedAgent;
        
        return new Response(JSON.stringify(updatedAgent), { status: 200, headers });
      }
      
      if (req.method === "DELETE") {
        console.log(`DELETE /server/agents/${id} - Deleting agent`);
        const index = agents.findIndex(a => a.id === id);
        
        if (index === -1) {
          return new Response(JSON.stringify({ error: 'Agent not found' }), { 
            status: 404, 
            headers 
          });
        }

        agents.splice(index, 1);
        return new Response(null, { status: 204, headers });
      }
    }

    // Handle defaults endpoint
    if (url.pathname === "/server/agents/defaults" && req.method === "POST") {
      console.log('POST /server/agents/defaults - Creating default agents');
      
      agents = DEFAULT_AGENTS.map(agent => ({
        ...agent,
        createdAt: new Date().toLocaleString(),
      }));
      
      return new Response(JSON.stringify(agents), { status: 200, headers });
    }

    if (url.pathname === "/agents") {
      // Read agents from timestep config
      try {
        const agentsContent = await Deno.readTextFile(timestepPaths.agentsConfig);
        const lines = agentsContent.split('\n').filter(line => line.trim());
        const timestepAgents = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(Boolean);

        return new Response(JSON.stringify(timestepAgents), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: `Agents configuration not found at: ${timestepPaths.agentsConfig}`
        }), {
          status: 404,
          headers
        });
      }
    }

    // For other endpoints, return placeholder data
    if (url.pathname === "/chats") {
      try {
        const contextsResponse = await listContexts();
        return new Response(JSON.stringify(contextsResponse.data), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to fetch contexts"
        }), {
          status: 500,
          headers
        });
      }
    }

    if (url.pathname === "/models") {
      try {
        const modelsResponse = await listModels();
        return new Response(JSON.stringify(modelsResponse.data), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to fetch models"
        }), {
          status: 500,
          headers
        });
      }
    }

    if (url.pathname === "/tools") {
      try {
        const toolsResponse = await listTools();
        return new Response(JSON.stringify(toolsResponse.data), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to fetch tools"
        }), {
          status: 500,
          headers
        });
      }
    }

    if (url.pathname === "/traces") {
      try {
        const tracesResponse = await listTraces();
        return new Response(JSON.stringify(tracesResponse.data), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to fetch traces"
        }), {
          status: 500,
          headers
        });
      }
    }

    if (url.pathname === "/settings/api-keys") {
      try {
        const apiKeysResponse = await listApiKeys();
        return new Response(JSON.stringify(apiKeysResponse.data), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to fetch API keys"
        }), {
          status: 500,
          headers
        });
      }
    }

    if (url.pathname === "/settings/mcp-servers") {
      try {
        const mcpServersResponse = await listMcpServers();
        return new Response(JSON.stringify(mcpServersResponse.data), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to fetch MCP servers"
        }), {
          status: 500,
          headers
        });
      }
    }

    return new Response("Not found", { status: 404, headers });
  } catch (error) {
    console.error('Error in CLI server:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error"
    }), {
      status: 500,
      headers
    });
  }
});

// Import the Express app from a2a_server.ts
// Note: We need to use dynamic import since a2a_server.ts uses ES modules
const { serverMain } = await import("./api/a2a_server.ts");
// Import the MCP server class
const { StatefulMCPServer } = await import("./api/mcp_server.ts");

console.log("🚀 Starting A2A Agent Server with Deno + Express");
console.log("📦 Using Express server from a2a_server.ts");

// Start the A2A server
serverMain();

// Start the MCP server
const mcpPort = Number(Deno.env.get("MCP_SERVER_PORT") ?? 8000);
const mcpServer = new StatefulMCPServer(mcpPort);
mcpServer.run().catch((error: Error) => {
  console.error("Failed to start MCP server:", error);
});