import { getTimestepPaths } from "../utils.ts";

export async function listModels() {
  const timestepPaths = getTimestepPaths();
  
  try {
    const modelsContent = await Deno.readTextFile(timestepPaths.modelsConfig);
    const lines = modelsContent.split('\n').filter(line => line.trim());
    const models = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return { data: models };
  } catch (error) {
    console.error('Error reading models config:', error);
    return { data: [] };
  }
}