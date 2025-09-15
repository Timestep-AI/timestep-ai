import { getTimestepPaths } from "../utils.ts";

export async function listTraces() {
  const timestepPaths = getTimestepPaths();
  
  try {
    const tracesContent = await Deno.readTextFile(timestepPaths.tracesConfig);
    const lines = tracesContent.split('\n').filter(line => line.trim());
    const traces = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return { data: traces };
  } catch (error) {
    console.error('Error reading traces config:', error);
    return { data: [] };
  }
}