import { getTimestepPaths } from "../utils.ts";

export async function listTools() {
  const timestepPaths = getTimestepPaths();
  
  try {
    const toolsContent = await Deno.readTextFile(timestepPaths.toolsConfig);
    const lines = toolsContent.split('\n').filter(line => line.trim());
    const tools = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return { data: tools };
  } catch (error) {
    console.error('Error reading tools config:', error);
    return { data: [] };
  }
}