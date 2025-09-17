import "https://deno.land/x/xhr@0.1.0/mod.ts";
import * as timestep from 'npm:@timestep-ai/timestep@2025.9.170717';

// Import functions from timestep library
const { getTimestepPaths } = timestep;
const { listModels } = timestep;
const { listContexts } = timestep;
const { listApiKeys } = timestep;
const { listMcpServers } = timestep;
const { listTraces } = timestep;
const { listTools } = timestep;
const { serverMain } = timestep;
const { StatefulMCPServer } = timestep;

// Get timestep configuration paths
const timestepPaths = getTimestepPaths();

// Start CLI endpoints server for the React CLI
const cliPort = 3000;
console.log(`🌐 Starting CLI endpoints server on port ${cliPort}`);

Deno.serve({ port: cliPort }, async (req: Request) => {
  const url = new URL(req.url);

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
    if (url.pathname === "/agents") {
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

console.log("🚀 Starting A2A Agent Server with Deno + Express");
console.log("📦 Using Express server from a2a_server.ts");

serverMain();

const mcpPort = Number(Deno.env.get("MCP_SERVER_PORT") ?? 8000);
const mcpServer = new StatefulMCPServer(mcpPort);
mcpServer.run().catch((error: Error) => {
  console.error("Failed to start MCP server:", error);
});