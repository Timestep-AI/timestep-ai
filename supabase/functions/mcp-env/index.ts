// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { McpServer } from 'npm:@modelcontextprotocol/sdk@^1.0.0/server/mcp.js';
import { StreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@^1.0.0/server/streamableHttp.js';
import { tools } from './tools/index.ts';

const mcpServer = new McpServer({
  name: 'Agent MCP Server',
  version: '1.0.0',
});

// Register all tools
tools.forEach((tool) => {
  mcpServer.registerTool(tool.name, tool.definition, tool.handler);
});

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

//

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders(req) });
  }

  const url = new URL(req.url);

  // Simple endpoint at root
  if (req.method === 'GET' && url.pathname.endsWith('/')) {
    return new Response('MCP Server running', {
      status: 200,
      headers: corsHeaders(req),
    });
  }

  // MCP endpoint: /mcp
  const mcpMatch = url.pathname.endsWith('/mcp');
  if (mcpMatch) {
    try {
      // Create a response wrapper that mimics Node.js response object
      let responseBody = '';
      let responseHeaders: Record<string, string> = {};
      let responseStatus = 200;
      let responsePromise: Promise<void> | null = null;
      let responseResolve: (() => void) | null = null;

      const mockRes = {
        writeHead: (status: number, headers?: Record<string, string>) => {
          responseStatus = status;
          if (headers) {
            responseHeaders = { ...responseHeaders, ...headers };
          }
          return mockRes; // Return self to allow chaining like res.writeHead().end()
        },
        write: (chunk: string) => {
          responseBody += chunk;
          return mockRes; // Return self to allow chaining
        },
        end: (chunk?: string) => {
          if (chunk) {
            responseBody += chunk;
          }
          // Resolve the promise when the response is complete
          if (responseResolve) {
            responseResolve();
          }
          return mockRes; // Return self to allow chaining
        },
        setHeader: (name: string, value: string) => {
          responseHeaders[name] = value;
          return mockRes; // Return self to allow chaining
        },
        getHeader: (name: string) => responseHeaders[name],
        removeHeader: (name: string) => {
          delete responseHeaders[name];
          return mockRes; // Return self to allow chaining
        },
        flushHeaders: () => {
          // Mock flushHeaders - in Node.js this would flush the headers to the client
          return mockRes; // Return self to allow chaining
        },
        on: (_event: string, _callback: () => void) => {
          // Mock event handling - in a real implementation you might want to track these
          return mockRes; // Return self to allow chaining
        },
      };

      // Create a new transport for each request to prevent request ID collisions
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: req.method === 'POST', // Use JSON for POST, SSE for GET
      });

      // Connect the transport to the MCP server
      // Each request needs its own transport instance to handle concurrent requests properly
      // We create a temporary connection just for this request
      const serverForRequest = new McpServer({
        name: 'Agent MCP Server',
        version: '1.0.0',
      });

      // Register all tools on this instance
      tools.forEach((tool) => {
        serverForRequest.registerTool(tool.name, tool.definition, tool.handler);
      });

      await serverForRequest.connect(transport);

      // Create a promise that resolves when the response is complete
      responsePromise = new Promise<void>((resolve) => {
        responseResolve = resolve;
      });

      // Create a mock request object that the MCP transport expects
      const url = new URL(req.url);

      // Build headers - do NOT accept authorization from query parameters for security
      const headers: Record<string, string> = {
        accept: req.method === 'GET' ? 'text/event-stream' : 'application/json, text/event-stream',
        'content-type': req.method === 'POST' ? 'application/json' : undefined,
        ...Object.fromEntries(req.headers.entries()),
      };

      const mockReq = {
        method: req.method,
        url: req.url,
        headers,
        body: req.method === 'POST' ? await req.json() : undefined,
      };

      await transport.handleRequest(mockReq as any, mockRes as unknown as any, mockReq.body);

      // Wait for the response to be complete (when end() is called)
      await responsePromise;

      return new Response(responseBody, {
        status: responseStatus,
        headers: { ...corsHeaders(req), ...responseHeaders },
      });
    } catch (error) {
      console.error('[MCP] Error:', error);
      return new Response(JSON.stringify({ error: 'Failed to handle MCP request' }), {
        status: 500,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
});
