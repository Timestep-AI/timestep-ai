export function getTimestepPaths() {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
  const timestepDir = `${homeDir}/.timestep`;
  
  return {
    agentsConfig: `${timestepDir}/agents.jsonl`,
    contextsConfig: `${timestepDir}/contexts.jsonl`,
    modelsConfig: `${timestepDir}/models.jsonl`,
    toolsConfig: `${timestepDir}/tools.jsonl`,
    tracesConfig: `${timestepDir}/traces.jsonl`,
    apiKeysConfig: `${timestepDir}/api_keys.jsonl`,
    mcpServersConfig: `${timestepDir}/mcp_servers.jsonl`,
  };
}