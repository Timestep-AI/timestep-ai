import { getTimestepPaths } from "../utils.ts";

export async function listContexts() {
  const timestepPaths = getTimestepPaths();
  
  try {
    const contextsContent = await Deno.readTextFile(timestepPaths.contextsConfig);
    const lines = contextsContent.split('\n').filter(line => line.trim());
    const contexts = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return { data: contexts };
  } catch (error) {
    console.error('Error reading contexts config:', error);
    return { data: [] };
  }
}