import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/integrations/supabase/types';

// Use local Supabase instance with service role key to bypass RLS for testing
const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// No need to initialize auth with service role key
export async function initializeAuth() {
  // Service role key bypasses RLS, no auth needed
  return null;
}

export async function getLatestThread() {
  // Retry up to 5 times with 1 second delay to wait for data to be stored
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from('threads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return data;
    }

    if (error) {
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }

    // Wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('No thread found after 5 retries');
}

export async function getThreadMessages(threadId: string) {
  const { data, error } = await supabase
    .from('thread_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('message_index', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getThreadRunStates(threadId: string) {
  const { data, error } = await supabase
    .from('thread_run_states')
    .select('*')
    .eq('thread_id', threadId);
  
  if (error) throw error;
  return data;
}
