/**
 * Alternative Supabase Edge Function using individual @timestep-ai/timestep functions
 *
 * This demonstrates how to manually build endpoints using individual library functions
 * instead of using the pre-built Express app. Use this approach when you need more
 * control over request handling or want to integrate with Supabase-specific features.
 *
 * Place this file in your Supabase project at: supabase/functions/timestep-server/index.ts
 *
 * To set up this function:
 * 1. deno add npm:@timestep-ai/timestep
 * 2. Copy this code to supabase/functions/timestep-server/index.ts
 * 3. Deploy with: supabase functions deploy timestep-server
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import {
  listAgents,
  listModels,
  listTools,
  listTraces,
  listContexts,
  listApiKeys,
  listMcpServers,
  listModelProviders,
  handleAgentRequest,
  TimestepAIAgentExecutor} from 'npm:@timestep-ai/timestep@2025.9.171050';

// Custom task store for Supabase environment
class SupabaseTaskStore {
  private store: Map<string, any> = new Map();

  async load(taskId: string): Promise<any | undefined> {
    console.log(`📋 SupabaseTaskStore.load(${taskId})`);
    const entry = this.store.get(taskId);
    if (entry) {
      console.log(`📋 SupabaseTaskStore.load(${taskId}) -> FOUND`);
      return {...entry};
    } else {
      console.log(`📋 SupabaseTaskStore.load(${taskId}) -> NOT FOUND`);
      return undefined;
    }
  }

  async save(task: any): Promise<void> {
    console.log(`📋 SupabaseTaskStore.save(${task.id})`);
    this.store.set(task.id, {...task});
    console.log(`📋 SupabaseTaskStore.save(${task.id}) -> SAVED`);
  }
}

// Initialize components
const agentExecutor = new TimestepAIAgentExecutor();
const taskStore = new SupabaseTaskStore();

// Configure the port from environment or default
const port = parseInt(Deno.env.get("PORT") || "3000");

console.log("🦕 Starting Timestep Server in Supabase Edge Function (Manual Mode)");
console.log(`🌐 Server will run on port ${port}`);

// Start the server with manual request handling
Deno.serve({ port }, async (request: Request) => {
  const url = new URL(request.url);
  console.log(`📝 ${request.method} ${url.pathname}`);

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
    "X-Runtime": "Supabase-Edge-Function-Manual",
    "X-Deployment-ID": Deno.env.get("DENO_DEPLOYMENT_ID") || "local"
  };

  if (request.method === "OPTIONS") {
    console.log(`✅ CORS preflight for ${url.pathname}`);
    return new Response(null, { status: 200, headers });
  }

  try {
    // Health check endpoints
    if (url.pathname === "/health" || url.pathname === "/supabase-health" || url.pathname === "/server/health" || url.pathname === "/server/supabase-health") {
      return new Response(JSON.stringify({
        status: 'healthy',
        runtime: 'Supabase Edge Function (Manual)',
        timestamp: new Date().toISOString(),
        denoVersion: Deno.version.deno,
        deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID") || "local",
        region: Deno.env.get("DENO_REGION") || "unknown",
        path: url.pathname
      }), { status: 200, headers });
    }

    // API endpoints using individual library functions
    if (url.pathname === "/agents" || url.pathname === "/server/agents") {
      console.log("🤖 Fetching agents...");
      try {
        const result = await listAgents();
        console.log(`✅ Found ${result.data?.length || 0} agents`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching agents:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    if (url.pathname === "/models" || url.pathname === "/server/models") {
      console.log("🧠 Fetching models...");
      try {
        const result = await listModels();
        console.log(`✅ Found ${result.data?.length || 0} models`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching models:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    if (url.pathname === "/tools" || url.pathname === "/server/tools") {
      console.log("🔧 Fetching tools...");
      try {
        const result = await listTools();
        console.log(`✅ Found ${result.data?.length || 0} tools`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching tools:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    if (url.pathname === "/traces" || url.pathname === "/server/traces") {
      console.log("📊 Fetching traces...");
      try {
        const result = await listTraces();
        console.log(`✅ Found ${result.data?.length || 0} traces`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching traces:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    if (url.pathname === "/chats" || url.pathname === "/server/chats") {
      console.log("💬 Fetching chats...");
      try {
        const result = await listContexts();
        console.log(`✅ Found ${result.data?.length || 0} chats`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching chats:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    if (url.pathname === "/settings/api-keys" || url.pathname === "/server/settings/api-keys") {
      console.log("🗝️ Fetching API keys...");
      try {
        const result = await listApiKeys();
        console.log(`✅ Found ${result.data?.length || 0} API keys`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching API keys:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    if (url.pathname === "/settings/mcp-servers" || url.pathname === "/server/settings/mcp-servers") {
      console.log("🔌 Fetching MCP servers...");
      try {
        const result = await listMcpServers();
        console.log(`✅ Found ${result.data?.length || 0} MCP servers`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching MCP servers:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    if (url.pathname === "/settings/model-providers" || url.pathname === "/server/settings/model-providers") {
      console.log("🏭 Fetching model providers...");
      try {
        const result = await listModelProviders();
        console.log(`✅ Found ${result.data?.length || 0} model providers`);
        return new Response(JSON.stringify(result.data || []), { status: 200, headers });
      } catch (error) {
        console.error("❌ Error fetching model providers:", error);
        return new Response(JSON.stringify([]), { status: 200, headers });
      }
    }

    // Handle dynamic agent routes
    const agentMatch = url.pathname.match(/^\/(?:server\/)?agents\/([^\/]+)(?:\/.*)?$/);
    if (agentMatch) {
      // Create a mock Express-style request object
      const mockReq = {
        method: request.method,
        path: url.pathname,
        originalUrl: url.pathname + url.search,
        params: { agentId: agentMatch[1] },
        body: request.method !== 'GET' ? await request.json().catch(() => ({})) : {},
        headers: Object.fromEntries(request.headers.entries())
      };

      try {
        const result = await handleAgentRequest(mockReq, null, null, taskStore, agentExecutor, port);
        return new Response(JSON.stringify(result), { status: 200, headers });
      } catch (error) {
        console.error('Error in agent request handler:', error);
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to handle agent request"
        }), { status: 500, headers });
      }
    }

    console.log(`❓ Unknown endpoint: ${url.pathname}`);
    return new Response(JSON.stringify({ error: "Not found", path: url.pathname }), { status: 404, headers });
  } catch (error) {
    console.error('Error in Supabase Edge Function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error"
    }), { status: 500, headers });
  }
});

console.log("🚀 Timestep Server running in Supabase Edge Function (Manual Mode)");
console.log("📚 Available endpoints:");
console.log("  - GET /health - Health check");
console.log("  - GET /supabase-health - Supabase-specific health check");
console.log("  - GET /agents - List agents");
console.log("  - GET /models - List models");
console.log("  - GET /tools - List tools");
console.log("  - GET /traces - List traces");
console.log("  - GET /chats - List chats");
console.log("  - GET /settings/api-keys - List API keys");
console.log("  - GET /settings/mcp-servers - List MCP servers");
console.log("  - GET /settings/model-providers - List model providers");
console.log("  - /agents/{agentId}/* - Dynamic agent A2A endpoints");