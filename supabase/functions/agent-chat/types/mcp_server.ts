export interface McpServerRecord {
  id: string;
  user_id: string;
  name: string;
  url: string;
  auth_config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
