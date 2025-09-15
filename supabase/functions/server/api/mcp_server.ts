export class StatefulMCPServer {
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  async run() {
    console.log(`🔌 MCP Server starting on port ${this.port}`);
    // MCP server implementation will be added here
    // This is a placeholder for now
  }
}