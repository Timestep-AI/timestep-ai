import { getTimestepPaths } from "../../utils.ts";

export async function listApiKeys() {
  const timestepPaths = getTimestepPaths();
  
  try {
    const apiKeysContent = await Deno.readTextFile(timestepPaths.apiKeysConfig);
    const lines = apiKeysContent.split('\n').filter(line => line.trim());
    const apiKeys = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return { data: apiKeys };
  } catch (error) {
    console.error('Error reading API keys config:', error);
    return { data: [] };
  }
}