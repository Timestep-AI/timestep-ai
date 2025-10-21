export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  instructions: string;
  tool_ids: string[];
  handoff_ids: string[];
  created_at: string;
  updated_at: string;
}
