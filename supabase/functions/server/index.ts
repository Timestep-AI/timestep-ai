import "https://deno.land/x/xhr@0.1.0/mod.ts";
import * as timestep from 'npm:@timestep-ai/timestep@2025.9.170717';

// Import functions from timestep library
const { getTimestepPaths } = timestep;
const { listModels } = timestep;
const { listContexts } = timestep;
const { listApiKeys } = timestep;
const { listMcpServers } = timestep;
const { listModelProviders } = timestep;
const { listTraces } = timestep;
const { listTools } = timestep;
const { TimestepAIAgentExecutor } = timestep;
const { StatefulMCPServer } = timestep;
const { handleListAgents } = timestep;
const { handleAgentRequest } = timestep;

// Get timestep configuration paths
const timestepPaths = getTimestepPaths();

// Custom task store with detailed logging
class LoggingTaskStore {
  private store: Map<string, any> = new Map();

  async load(taskId: string): Promise<any | undefined> {
    console.log(`📋 TaskStore.load(${taskId})`);
    const entry = this.store.get(taskId);
    if (entry) {
      console.log(`📋 TaskStore.load(${taskId}) -> FOUND:`, {
        id: entry.id,
        contextId: entry.contextId,
        kind: entry.kind,
        status: entry.status
      });
      return {...entry};
    } else {
      console.log(`📋 TaskStore.load(${taskId}) -> NOT FOUND`);
      console.log(`📋 TaskStore current keys:`, Array.from(this.store.keys()));
      return undefined;
    }
  }

  async save(task: any): Promise<void> {
    console.log(`📋 TaskStore.save(${task.id})`, {
      id: task.id,
      contextId: task.contextId,
      kind: task.kind,
      status: task.status
    });
    this.store.set(task.id, {...task});
    console.log(`📋 TaskStore.save(${task.id}) -> SAVED`);
    console.log(`📋 TaskStore current keys after save:`, Array.from(this.store.keys()));
  }
}

// A2A server components
const agentExecutor = new TimestepAIAgentExecutor();
const sharedTaskStore = new LoggingTaskStore();

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

  console.log(`🔍 Request received: ${req.method} ${url.pathname}`);

  try {
    // Test route
    if (url.pathname === "/test-agent") {
      console.log(`🔍 Test route called`);
      return new Response(JSON.stringify({ message: 'Test route working' }), {
        status: 200,
        headers
      });
    }

    // Agents list endpoint
    if (url.pathname === "/agents" && req.method === "GET") {
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

    // Dynamic agent route handler - handle /agents/:agentId paths
    const agentMatch = url.pathname.match(/^\/agents\/([^\/]+)(?:\/.*)?$/);
    if (agentMatch) {
      console.log(`🔍 A2A route handler called for: ${req.method} ${url.pathname}`);
      // Create a mock request/response object compatible with Express-style handlers
      const mockReq = {
        method: req.method,
        path: url.pathname,
        originalUrl: url.pathname + url.search,
        params: { agentId: agentMatch[1] },
        body: req.method !== 'GET' ? await req.json().catch(() => ({})) : {},
        headers: Object.fromEntries(req.headers.entries())
      };

      try {
        const result = await handleAgentRequest(mockReq, null, null, sharedTaskStore, agentExecutor, cliPort);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers
        });
      } catch (error) {
        console.error('Error in agent request handler:', error);
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to handle agent request"
        }), {
          status: 500,
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

    if (url.pathname === "/settings/model-providers") {
      try {
        const modelProvidersResponse = await listModelProviders();
        return new Response(JSON.stringify(modelProvidersResponse.data), {
          status: 200,
          headers
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to fetch model providers"
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

console.log("🚀 Starting A2A Agent Server with Deno");
console.log("📦 Using native timestep library without serverMain");
console.log(`🌐 Unified server running on http://localhost:${cliPort}`);
console.log(`📚 CLI endpoints available at http://localhost:${cliPort}/`);
console.log(`🤖 A2A agents available at http://localhost:${cliPort}/agents/{agentId}/`);
console.log(`📚 Dynamic agent routing enabled - agents loaded on-demand`);

const mcpPort = Number(Deno.env.get("MCP_SERVER_PORT") ?? 8000);
const mcpServer = new StatefulMCPServer(mcpPort);
mcpServer.run().catch((error: Error) => {
  console.error("Failed to start MCP server:", error);
});