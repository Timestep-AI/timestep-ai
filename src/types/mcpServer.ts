export interface MCPServer {
  id: string; // UUID in database but string in API
  name: string;
  description: string;
  serverUrl?: string; // Made optional to match edge function
  enabled: boolean;
  authToken?: string;
  command?: string; // Added to match new schema
  args?: any; // Added to match new schema
  createdAt?: string;
  updatedAt?: string;
}