// Mock MCP Server for tools
// This simulates an MCP server that provides the tools: get_emails, get_weather, think

import { Tool } from '@/types/tool';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPListToolsResponse {
  tools: MCPTool[];
}

export interface MCPCallToolRequest {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPCallToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

// Mock MCP tools that correspond to our Tool interface
const mcpTools: MCPTool[] = [
  {
    name: 'get_emails',
    description: 'Retrieve and manage email messages from various email accounts',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Email account to retrieve from' },
        limit: { type: 'number', description: 'Maximum number of emails to retrieve' }
      },
      required: ['account']
    }
  },
  {
    name: 'get_weather',
    description: 'Get current weather conditions and forecasts for any location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Location to get weather for' },
        units: { type: 'string', enum: ['celsius', 'fahrenheit'], description: 'Temperature units' }
      },
      required: ['location']
    }
  },
  {
    name: 'think',
    description: 'Process information and provide thoughtful analysis and reasoning',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query or problem to analyze' },
        context: { type: 'string', description: 'Additional context for analysis' }
      },
      required: ['query']
    }
  }
];

// Convert MCP tool to our Tool interface
function mcpToolToTool(mcpTool: MCPTool, index: number): Tool {
  return {
    id: (index + 1).toString(),
    name: mcpTool.name,
    description: mcpTool.description,
    category: getToolCategory(mcpTool.name),
    version: '1.0.0',
    isEnabled: true,
    permissions: ['read'],
    status: 'active',
    lastUsed: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    usage: {
      daily: Math.floor(Math.random() * 50),
      weekly: Math.floor(Math.random() * 300),
      monthly: Math.floor(Math.random() * 1200)
    }
  };
}

function getToolCategory(toolName: string): Tool['category'] {
  switch (toolName) {
    case 'get_emails': return 'communication';
    case 'get_weather': return 'productivity';
    case 'think': return 'analysis';
    default: return 'productivity';
  }
}

export class MCPMockServer {
  private tools: MCPTool[] = [...mcpTools];

  // Simulate MCP tools/list method
  async listTools(): Promise<MCPListToolsResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return { tools: this.tools };
  }

  // Simulate MCP tools/call method
  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const tool = this.tools.find(t => t.name === request.name);
    if (!tool) {
      throw new Error(`Tool '${request.name}' not found`);
    }

    // Mock responses for different tools
    let responseText: string;
    switch (request.name) {
      case 'get_emails':
        responseText = `Retrieved ${Math.floor(Math.random() * 10) + 1} emails from ${request.arguments.account || 'default account'}`;
        break;
      case 'get_weather':
        responseText = `Current weather in ${request.arguments.location}: ${Math.floor(Math.random() * 30) + 5}°C, ${['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]}`;
        break;
      case 'think':
        responseText = `Analysis of "${request.arguments.query}": This requires careful consideration of multiple factors...`;
        break;
      default:
        responseText = `Executed ${request.name} successfully`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  }

  // Convert MCP tools to our Tool interface
  async getToolsAsToolInterface(): Promise<Tool[]> {
    const mcpResponse = await this.listTools();
    return mcpResponse.tools.map((mcpTool, index) => mcpToolToTool(mcpTool, index));
  }

  // Get tool by ID (converted from MCP)
  async getToolById(id: string): Promise<Tool | undefined> {
    const tools = await this.getToolsAsToolInterface();
    return tools.find(tool => tool.id === id);
  }
}

// Singleton instance
export const mcpMockServer = new MCPMockServer();