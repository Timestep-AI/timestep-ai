export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4';
  };
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string | null;
          handoff_ids: string[];
          id: string;
          instructions: string;
          model: string | null;
          model_settings: Json | null;
          name: string;
          tool_ids: string[];
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          handoff_ids?: string[];
          id: string;
          instructions: string;
          model?: string | null;
          model_settings?: Json | null;
          name: string;
          tool_ids?: string[];
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          handoff_ids?: string[];
          id?: string;
          instructions?: string;
          model?: string | null;
          model_settings?: Json | null;
          name?: string;
          tool_ids?: string[];
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      files: {
        Row: {
          bytes: number;
          content_type: string;
          created_at: number;
          created_at_ts: string;
          embedding: string | null;
          expires_at: number | null;
          filename: string;
          id: string;
          purpose: string;
          status: string;
          status_details: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bytes: number;
          content_type?: string;
          created_at: number;
          created_at_ts?: string;
          embedding?: string | null;
          expires_at?: number | null;
          filename: string;
          id: string;
          purpose: string;
          status?: string;
          status_details?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bytes?: number;
          content_type?: string;
          created_at?: number;
          created_at_ts?: string;
          embedding?: string | null;
          expires_at?: number | null;
          filename?: string;
          id?: string;
          purpose?: string;
          status?: string;
          status_details?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      mcp_servers: {
        Row: {
          auth_config: Json | null;
          created_at: string | null;
          id: string;
          name: string;
          updated_at: string | null;
          url: string;
          user_id: string;
        };
        Insert: {
          auth_config?: Json | null;
          created_at?: string | null;
          id: string;
          name: string;
          updated_at?: string | null;
          url: string;
          user_id: string;
        };
        Update: {
          auth_config?: Json | null;
          created_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string | null;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      thread_messages: {
        Row: {
          content: string | null;
          created_at: string;
          file_id: string | null;
          id: string;
          message_index: number;
          name: string | null;
          role: string;
          thread_id: string;
          tool_call_id: string | null;
          tool_calls: Json | null;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          file_id?: string | null;
          id: string;
          message_index: number;
          name?: string | null;
          role: string;
          thread_id: string;
          tool_call_id?: string | null;
          tool_calls?: Json | null;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          file_id?: string | null;
          id?: string;
          message_index?: number;
          name?: string | null;
          role?: string;
          thread_id?: string;
          tool_call_id?: string | null;
          tool_calls?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'thread_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'threads';
            referencedColumns: ['id'];
          },
        ];
      };
      thread_run_states: {
        Row: {
          state_data: string;
          thread_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          state_data: string;
          thread_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          state_data?: string;
          thread_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      threads: {
        Row: {
          created_at: number;
          embedding: string | null;
          id: string;
          metadata: Json | null;
          object: string;
          updated_at: string;
          user_id: string;
          vector_store_id: string | null;
        };
        Insert: {
          created_at: number;
          embedding?: string | null;
          id: string;
          metadata?: Json | null;
          object?: string;
          updated_at?: string;
          user_id: string;
          vector_store_id?: string | null;
        };
        Update: {
          created_at?: number;
          embedding?: string | null;
          id?: string;
          metadata?: Json | null;
          object?: string;
          updated_at?: string;
          user_id?: string;
          vector_store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_threads_vector_store_id';
            columns: ['vector_store_id'];
            isOneToOne: false;
            referencedRelation: 'vector_stores';
            referencedColumns: ['id'];
          },
        ];
      };
      uploads: {
        Row: {
          bytes: number;
          bytes_uploaded: number;
          created_at: number;
          created_at_ts: string;
          expires_at: number;
          file_id: string | null;
          filename: string;
          id: string;
          mime_type: string;
          part_ids: string[] | null;
          purpose: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bytes: number;
          bytes_uploaded?: number;
          created_at: number;
          created_at_ts?: string;
          expires_at: number;
          file_id?: string | null;
          filename: string;
          id: string;
          mime_type: string;
          part_ids?: string[] | null;
          purpose: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bytes?: number;
          bytes_uploaded?: number;
          created_at?: number;
          created_at_ts?: string;
          expires_at?: number;
          file_id?: string | null;
          filename?: string;
          id?: string;
          mime_type?: string;
          part_ids?: string[] | null;
          purpose?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      vector_store_files: {
        Row: {
          chunking_strategy: Json | null;
          chunking_strategy_type: string | null;
          created_at: number;
          created_at_ts: string;
          embedding: string | null;
          file_id: string;
          id: string;
          last_error: string | null;
          status: string;
          updated_at: string;
          usage_bytes: number;
          user_id: string;
          vector_store_id: string;
        };
        Insert: {
          chunking_strategy?: Json | null;
          chunking_strategy_type?: string | null;
          created_at: number;
          created_at_ts?: string;
          embedding?: string | null;
          file_id: string;
          id: string;
          last_error?: string | null;
          status?: string;
          updated_at?: string;
          usage_bytes?: number;
          user_id: string;
          vector_store_id: string;
        };
        Update: {
          chunking_strategy?: Json | null;
          chunking_strategy_type?: string | null;
          created_at?: number;
          created_at_ts?: string;
          embedding?: string | null;
          file_id?: string;
          id?: string;
          last_error?: string | null;
          status?: string;
          updated_at?: string;
          usage_bytes?: number;
          user_id?: string;
          vector_store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vector_store_files_file_id_fkey';
            columns: ['file_id'];
            isOneToOne: false;
            referencedRelation: 'files';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vector_store_files_vector_store_id_fkey';
            columns: ['vector_store_id'];
            isOneToOne: false;
            referencedRelation: 'vector_stores';
            referencedColumns: ['id'];
          },
        ];
      };
      vector_stores: {
        Row: {
          created_at: number;
          created_at_ts: string;
          description: string | null;
          expires_after_anchor: string | null;
          expires_after_days: number | null;
          expires_at: number | null;
          files_cancelled: number;
          files_completed: number;
          files_failed: number;
          files_in_progress: number;
          files_total: number;
          id: string;
          last_active_at: number | null;
          metadata: Json | null;
          name: string;
          status: string;
          updated_at: string;
          usage_bytes: number;
          user_id: string;
        };
        Insert: {
          created_at: number;
          created_at_ts?: string;
          description?: string | null;
          expires_after_anchor?: string | null;
          expires_after_days?: number | null;
          expires_at?: number | null;
          files_cancelled?: number;
          files_completed?: number;
          files_failed?: number;
          files_in_progress?: number;
          files_total?: number;
          id: string;
          last_active_at?: number | null;
          metadata?: Json | null;
          name: string;
          status?: string;
          updated_at?: string;
          usage_bytes?: number;
          user_id: string;
        };
        Update: {
          created_at?: number;
          created_at_ts?: string;
          description?: string | null;
          expires_after_anchor?: string | null;
          expires_after_days?: number | null;
          expires_at?: number | null;
          files_cancelled?: number;
          files_completed?: number;
          files_failed?: number;
          files_in_progress?: number;
          files_total?: number;
          id?: string;
          last_active_at?: number | null;
          metadata?: Json | null;
          name?: string;
          status?: string;
          updated_at?: string;
          usage_bytes?: number;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      binary_quantize: {
        Args: { '': string } | { '': unknown };
        Returns: unknown;
      };
      get_next_message_index: {
        Args: { p_thread_id: string };
        Returns: number;
      };
      halfvec_avg: {
        Args: { '': number[] };
        Returns: unknown;
      };
      halfvec_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      halfvec_send: {
        Args: { '': unknown };
        Returns: string;
      };
      halfvec_typmod_in: {
        Args: { '': unknown[] };
        Returns: number;
      };
      hnsw_bit_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      hnsw_halfvec_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      hnsw_sparsevec_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      hnswhandler: {
        Args: { '': unknown };
        Returns: unknown;
      };
      ivfflat_bit_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      ivfflat_halfvec_support: {
        Args: { '': unknown };
        Returns: unknown;
      };
      ivfflathandler: {
        Args: { '': unknown };
        Returns: unknown;
      };
      l2_norm: {
        Args: { '': unknown } | { '': unknown };
        Returns: number;
      };
      l2_normalize: {
        Args: { '': string } | { '': unknown } | { '': unknown };
        Returns: unknown;
      };
      search_files_by_embedding: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          query_embedding: string;
        };
        Returns: {
          bytes: number;
          created_at: number;
          filename: string;
          id: string;
          purpose: string;
          similarity: number;
          status: string;
          user_id: string;
        }[];
      };
      search_threads_by_embedding: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          query_embedding: string;
        };
        Returns: {
          created_at: number;
          id: string;
          metadata: Json;
          object: string;
          similarity: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      sparsevec_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      sparsevec_send: {
        Args: { '': unknown };
        Returns: string;
      };
      sparsevec_typmod_in: {
        Args: { '': unknown[] };
        Returns: number;
      };
      vector_avg: {
        Args: { '': number[] };
        Returns: string;
      };
      vector_dims: {
        Args: { '': string } | { '': unknown };
        Returns: number;
      };
      vector_norm: {
        Args: { '': string };
        Returns: number;
      };
      vector_out: {
        Args: { '': string };
        Returns: unknown;
      };
      vector_send: {
        Args: { '': string };
        Returns: string;
      };
      vector_typmod_in: {
        Args: { '': unknown[] };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
