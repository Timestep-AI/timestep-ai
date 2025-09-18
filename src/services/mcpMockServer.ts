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
    name: '00000000-0000-0000-0000-000000000000.get_emails',
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
    name: '00000000-0000-0000-0000-000000000000.get_weather',
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
    name: '00000000-0000-0000-0000-000000000000.think',
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
    serverId: 'mock-server-' + index,
    serverName: getMcpServerName(mcpTool.name),
    inputSchema: mcpTool.inputSchema,
    category: getToolCategory(mcpTool.name),
    status: 'available'
  };
}

function getMcpServerName(toolName: string): string {
  // Check if tool belongs to the built-in MCP server
  if (toolName.startsWith('00000000-0000-0000-0000-000000000000.')) {
    return 'Built-in MCP Server';
  }
  
  const actualToolName = toolName.split('.').pop() || toolName;
  switch (actualToolName) {
    case 'get_emails': return 'Gmail Server';
    case 'get_weather': return 'Weather API Server';
    case 'think': return 'AI Reasoning Server';
    default: return 'Generic Server';
  }
}

function getToolCategory(toolName: string): string {
  const actualToolName = toolName.split('.').pop() || toolName;
  switch (actualToolName) {
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
    const actualToolName = request.name.split('.').pop() || request.name;
    switch (actualToolName) {
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