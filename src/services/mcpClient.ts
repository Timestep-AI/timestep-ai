// MCP Client for tools using the mock server
// This simulates using the MCP TypeScript SDK to communicate with tools

import { Tool, CreateToolRequest, UpdateToolRequest } from '@/types/tool';
import { mcpMockServer, MCPCallToolRequest } from './mcpMockServer';

export interface MCPClientOptions {
  serverUrl?: string;
  name?: string;
  version?: string;
}

export class MCPClient {
  private options: MCPClientOptions;
  private connected: boolean = false;

  constructor(options: MCPClientOptions = {}) {
    this.options = {
      serverUrl: options.serverUrl || 'http://localhost:3000/mcp',
      name: options.name || 'tools-client',
      version: options.version || '1.0.0'
    };
  }

  async connect(): Promise<void> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 200));
    this.connected = true;
    console.log(`MCP Client connected to ${this.options.serverUrl}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('MCP Client disconnected');
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('MCP Client not connected. Call connect() first.');
    }
  }

  // List all available tools
  async listTools(): Promise<Tool[]> {
    this.ensureConnected();
    return await mcpMockServer.getToolsAsToolInterface();
  }

  // Get a specific tool by ID
  async getTool(id: string): Promise<Tool | undefined> {
    this.ensureConnected();
    return await mcpMockServer.getToolById(id);
  }

  // Call a tool with arguments
  async callTool(name: string, args: Record<string, any> = {}): Promise<string> {
    this.ensureConnected();
    
    const request: MCPCallToolRequest = {
      name,
      arguments: args
    };

    const response = await mcpMockServer.callTool(request);
    
    // Extract text content from response
    return response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
  }

  // Mock operations for CRUD (these would typically not be part of MCP)
  // but we need them to maintain compatibility with existing interface
  async createTool(toolData: CreateToolRequest): Promise<Tool> {
    // In a real MCP implementation, tool creation would be server-side
    // For now, we'll simulate it
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const tools = await this.listTools();
    const newTool: Tool = {
      id: (tools.length + 1).toString(),
      name: toolData.name,
      description: toolData.description,
      serverId: toolData.serverId,
      serverName: toolData.serverName,
      category: toolData.category,
      status: toolData.status ?? 'available'
    };
    
    return newTool;
  }

  async updateTool(id: string, updateData: UpdateToolRequest): Promise<Tool> {
    // In a real MCP implementation, tool updates would be server-side
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const tool = await this.getTool(id);
    if (!tool) {
      throw new Error(`Tool with id ${id} not found`);
    }
    
    const updatedTool = {
      ...tool,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    return updatedTool;
  }

  async deleteTool(id: string): Promise<void> {
    // In a real MCP implementation, tool deletion would be server-side
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const tool = await this.getTool(id);
    if (!tool) {
      throw new Error(`Tool with id ${id} not found`);
    }
    
    // Simulate deletion
    console.log(`Tool ${id} deleted (simulated)`);
  }

  async deleteAllTools(): Promise<void> {
    // In a real MCP implementation, this would be server-side
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('All tools deleted (simulated)');
  }

  async createDefaultTools(): Promise<Tool[]> {
    // Reset to default MCP tools
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return await this.listTools();
  }
}

// Singleton instance
export const mcpClient = new MCPClient();

// Auto-connect on import (for simplicity)
mcpClient.connect().catch(console.error);