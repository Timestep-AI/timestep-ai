export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_cards: {
        Row: {
          additional_interfaces: Json | null
          agent_id: string
          capabilities: Json
          created_at: string | null
          default_input_modes: Json
          default_output_modes: Json
          description: string
          documentation_url: string | null
          icon_url: string | null
          id: string
          name: string
          preferred_transport: string | null
          protocol_version: string
          provider: Json | null
          security: Json | null
          security_schemes: Json | null
          signatures: Json | null
          skills: Json
          supports_authenticated_extended_card: boolean | null
          updated_at: string | null
          url: string
          version: string
        }
        Insert: {
          additional_interfaces?: Json | null
          agent_id: string
          capabilities?: Json
          created_at?: string | null
          default_input_modes?: Json
          default_output_modes?: Json
          description: string
          documentation_url?: string | null
          icon_url?: string | null
          id?: string
          name: string
          preferred_transport?: string | null
          protocol_version?: string
          provider?: Json | null
          security?: Json | null
          security_schemes?: Json | null
          signatures?: Json | null
          skills?: Json
          supports_authenticated_extended_card?: boolean | null
          updated_at?: string | null
          url: string
          version?: string
        }
        Update: {
          additional_interfaces?: Json | null
          agent_id?: string
          capabilities?: Json
          created_at?: string | null
          default_input_modes?: Json
          default_output_modes?: Json
          description?: string
          documentation_url?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          preferred_transport?: string | null
          protocol_version?: string
          provider?: Json | null
          security?: Json | null
          security_schemes?: Json | null
          signatures?: Json | null
          skills?: Json
          supports_authenticated_extended_card?: boolean | null
          updated_at?: string | null
          url?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_cards_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string | null
          handoff_description: string
          handoffs: Json
          id: string
          input_guardrails: Json
          instructions: string
          mcp_servers: Json
          model: string | null
          model_api_key_id: string | null
          model_settings: Json
          name: string
          output_guardrails: Json
          output_type: string
          prompt: Json | null
          reset_tool_choice: boolean
          tool_use_behavior: string
          tools: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          handoff_description?: string
          handoffs?: Json
          id?: string
          input_guardrails?: Json
          instructions: string
          mcp_servers?: Json
          model?: string | null
          model_api_key_id?: string | null
          model_settings?: Json
          name: string
          output_guardrails?: Json
          output_type?: string
          prompt?: Json | null
          reset_tool_choice?: boolean
          tool_use_behavior?: string
          tools?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          handoff_description?: string
          handoffs?: Json
          id?: string
          input_guardrails?: Json
          instructions?: string
          mcp_servers?: Json
          model?: string | null
          model_api_key_id?: string | null
          model_settings?: Json
          name?: string
          output_guardrails?: Json
          output_type?: string
          prompt?: Json | null
          reset_tool_choice?: boolean
          tool_use_behavior?: string
          tools?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_model_api_key_id_fkey"
            columns: ["model_api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_encrypted: string
          name: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_encrypted: string
          name: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_encrypted?: string
          name?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      artifacts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          task_id: string
          updated_at: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          task_id: string
          updated_at?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          messages: Json | null
          model_id: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          messages?: Json | null
          model_id?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          messages?: Json | null
          model_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      contexts: {
        Row: {
          agent_id: string
          conversation_context: Json | null
          created_at: string | null
          description: string | null
          id: string
          last_activity_at: string | null
          metadata: Json | null
          pending_interruptions: Json | null
          serialized_agent_state: string | null
          status: string | null
          task_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          conversation_context?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          pending_interruptions?: Json | null
          serialized_agent_state?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          conversation_context?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          pending_interruptions?: Json | null
          serialized_agent_state?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contexts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          token: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      mcp_servers: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      parts: {
        Row: {
          artifact_id: string
          content: Json | null
          created_at: string | null
          file_bytes: string | null
          file_name: string | null
          file_uri: string | null
          id: string
          kind: string
          metadata: Json | null
          mime_type: string | null
          reference_artifacts: Json | null
          user_id: string
        }
        Insert: {
          artifact_id: string
          content?: Json | null
          created_at?: string | null
          file_bytes?: string | null
          file_name?: string | null
          file_uri?: string | null
          id?: string
          kind: string
          metadata?: Json | null
          mime_type?: string | null
          reference_artifacts?: Json | null
          user_id: string
        }
        Update: {
          artifact_id?: string
          content?: Json | null
          created_at?: string | null
          file_bytes?: string | null
          file_name?: string | null
          file_uri?: string | null
          id?: string
          kind?: string
          metadata?: Json | null
          mime_type?: string | null
          reference_artifacts?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      push_notification_configs: {
        Row: {
          created_at: string | null
          headers: Json | null
          id: string
          status: string
          task_id: string
          updated_at: string | null
          user_id: string
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          headers?: Json | null
          id?: string
          status?: string
          task_id: string
          updated_at?: string | null
          user_id: string
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          headers?: Json | null
          id?: string
          status?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_configs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      spans: {
        Row: {
          attributes: Json | null
          created_at: string | null
          duration_ms: number | null
          end_time: string | null
          error_message: string | null
          events: Json | null
          id: string
          input_data: Json | null
          kind: string
          links: Json | null
          name: string
          operation_details: Json | null
          operation_type: string | null
          output_data: Json | null
          parent_span_id: string | null
          span_id: string
          start_time: string
          status: string
          token_usage: Json | null
          trace_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          end_time?: string | null
          error_message?: string | null
          events?: Json | null
          id?: string
          input_data?: Json | null
          kind?: string
          links?: Json | null
          name: string
          operation_details?: Json | null
          operation_type?: string | null
          output_data?: Json | null
          parent_span_id?: string | null
          span_id: string
          start_time: string
          status?: string
          token_usage?: Json | null
          trace_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          end_time?: string | null
          error_message?: string | null
          events?: Json | null
          id?: string
          input_data?: Json | null
          kind?: string
          links?: Json | null
          name?: string
          operation_details?: Json | null
          operation_type?: string | null
          output_data?: Json | null
          parent_span_id?: string | null
          span_id?: string
          start_time?: string
          status?: string
          token_usage?: Json | null
          trace_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spans_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "traces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_artifact_events: {
        Row: {
          artifact_id: string
          change_data: Json | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          task_id: string
          user_id: string
        }
        Insert: {
          artifact_id: string
          change_data?: Json | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          task_id: string
          user_id: string
        }
        Update: {
          artifact_id?: string
          change_data?: Json | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_artifact_events_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_artifact_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_events: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          new_status: string
          previous_status: string | null
          reason: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_status: string
          previous_status?: string | null
          reason?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string
          previous_status?: string | null
          reason?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          context_id: string
          created_at: string | null
          id: string
          initiator: string
          metadata: Json | null
          reference_task_ids: string[] | null
          status: string
          updated_at: string | null
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          context_id: string
          created_at?: string | null
          id?: string
          initiator?: string
          metadata?: Json | null
          reference_task_ids?: string[] | null
          status?: string
          updated_at?: string | null
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          context_id?: string
          created_at?: string | null
          id?: string
          initiator?: string
          metadata?: Json | null
          reference_task_ids?: string[] | null
          status?: string
          updated_at?: string | null
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      traces: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          attributes: Json | null
          context: Json | null
          created_at: string | null
          duration_ms: number | null
          end_time: string | null
          error_message: string | null
          id: string
          model_name: string | null
          name: string
          span_count: number | null
          start_time: string
          status: string
          trace_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          attributes?: Json | null
          context?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          end_time?: string | null
          error_message?: string | null
          id?: string
          model_name?: string | null
          name: string
          span_count?: number | null
          start_time: string
          status?: string
          trace_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          attributes?: Json | null
          context?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          end_time?: string | null
          error_message?: string | null
          id?: string
          model_name?: string | null
          name?: string
          span_count?: number | null
          start_time?: string
          status?: string
          trace_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traces_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          created_at: string
          id: string
          invites_remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invites_remaining?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invites_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_email_signup: {
        Args: { check_email: string }
        Returns: boolean
      }
      create_encrypted_api_key: {
        Args: {
          p_key: string
          p_name: string
          p_passphrase: string
          p_provider: string
        }
        Returns: {
          created_at: string
          id: string
          key_encrypted: string
          name: string
          provider: string
          updated_at: string
          user_id: string
        }
      }
      create_invite: {
        Args: { invite_email: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          token: string
          updated_at: string
          used_at: string | null
        }
      }
      create_invite_for_email: {
        Args: { invite_email: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          token: string
          updated_at: string
          used_at: string | null
        }
      }
      decrease_user_invites: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_decrypted_api_key: {
        Args: { p_id: string; p_passphrase: string }
        Returns: string
      }
      get_decrypted_api_key_service_role: {
        Args: { p_id: string; p_passphrase: string }
        Returns: string
      }
      initialize_first_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_encrypted_api_key: {
        Args: {
          p_id: string
          p_key?: string
          p_name?: string
          p_passphrase?: string
          p_provider?: string
        }
        Returns: {
          created_at: string
          id: string
          key_encrypted: string
          name: string
          provider: string
          updated_at: string
          user_id: string
        }
      }
      use_invite: {
        Args: { invite_token: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          token: string
          updated_at: string
          used_at: string | null
        }
      }
      use_invite_and_setup_user: {
        Args: { user_email: string; user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
