import { getTimestepPaths } from "../../utils.ts";

export async function listMcpServers() {
  const timestepPaths = getTimestepPaths();
  
  try {
    const mcpServersContent = await Deno.readTextFile(timestepPaths.mcpServersConfig);
    const lines = mcpServersContent.split('\n').filter(line => line.trim());
    const mcpServers = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return { data: mcpServers };
  } catch (error) {
    console.error('Error reading MCP servers config:', error);
    return { data: [] };
  }
}