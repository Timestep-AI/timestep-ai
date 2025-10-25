import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createOpenAIClient } from '../utils/openai_client.ts';

/**
 * Repository for thread run state operations
 * 
 * Handles all database interactions related to thread_run_states table.
 * This store is responsible for managing agent execution state, conversation
 * context, and other runtime state information that persists across agent runs.
 */
export class ThreadRunStateStore {
  private supabase: any;
  private openai: any;

  constructor(
    private supabaseUrl: string,
    private userJwt: string,
    private userId: string
  ) {
    // Create Supabase client for database access with user's JWT
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    this.supabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userJwt}`,
        },
      },
    });

    // Create OpenAI client pointing to our polyfill for vector stores, files, etc.
    this.openai = createOpenAIClient(supabaseUrl, userJwt);
  }

  /**
   * Save run state for a thread
   */
  async saveRunState(threadId: string, state: string): Promise<void> {
    const { error } = await this.supabase
      .from('thread_run_states')
      .upsert({
        thread_id: threadId,
        user_id: this.userId,
        state_data: state,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'thread_id,user_id' });

    if (error) {
      console.error('Error saving run state:', error);
      throw new Error(`Failed to save run state: ${error.message}`);
    }
  }

  /**
   * Load run state for a thread
   */
  async loadRunState(threadId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('thread_run_states')
      .select('state_data')
      .eq('thread_id', threadId)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error loading run state:', error);
      throw new Error(`Failed to load run state: ${error.message}`);
    }

    return data?.state_data || null;
  }

  /**
   * Clear run state for a thread
   */
  async clearRunState(threadId: string): Promise<void> {
    const { error } = await this.supabase
      .from('thread_run_states')
      .delete()
      .eq('thread_id', threadId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('Error clearing run state:', error);
      throw new Error(`Failed to clear run state: ${error.message}`);
    }
  }

  /**
   * Check if run state exists for a thread
   */
  async hasRunState(threadId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('thread_run_states')
      .select('thread_id')
      .eq('thread_id', threadId)
      .eq('user_id', this.userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // Not found
      }
      console.error('Error checking run state:', error);
      throw new Error(`Failed to check run state: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Get all run states for a user (for debugging/admin purposes)
   */
  async getAllRunStates(): Promise<Array<{ thread_id: string; state_data: string; updated_at: string }>> {
    const { data, error } = await this.supabase
      .from('thread_run_states')
      .select('thread_id, state_data, updated_at')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading all run states:', error);
      throw new Error(`Failed to load all run states: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete run states older than specified days
   */
  async cleanupOldRunStates(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await this.supabase
      .from('thread_run_states')
      .delete()
      .eq('user_id', this.userId)
      .lt('updated_at', cutoffDate.toISOString())
      .select('thread_id');

    if (error) {
      console.error('Error cleaning up old run states:', error);
      throw new Error(`Failed to cleanup old run states: ${error.message}`);
    }

    return data?.length || 0;
  }
}
