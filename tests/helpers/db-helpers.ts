import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';

// Use local Supabase instance with service role key to bypass RLS for testing
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// No need to initialize auth with service role key
export async function initializeAuth() {
  // Service role key bypasses RLS, no auth needed
  return null;
}

/**
 * Get the latest thread, optionally filtered by test ID.
 * When testId is provided, we look for threads created within a specific time window
 * to isolate parallel test execution.
 * Note: threads.created_at is a Unix timestamp (number), not an ISO string.
 */
export async function getLatestThread(testId?: string) {
  // Retry up to 5 times with 1 second delay to wait for data to be stored
  for (let i = 0; i < 5; i++) {
    let query = supabase.from('threads').select('*').order('created_at', { ascending: false });

    // For parallel test isolation, if testId is provided, we filter by created_at
    // to only get threads created in the last few minutes
    // This ensures each test gets its own thread even when running in parallel
    if (testId) {
      const fiveMinutesAgo = Math.floor((Date.now() - 5 * 60 * 1000) / 1000);
      query = query.gte('created_at', fiveMinutesAgo);
    }

    const { data, error } = await query.limit(1).single();

    if (data) {
      return data;
    }

    if (error) {
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }

    // Wait 1 second before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`No thread found after 5 retries${testId ? ` for test ${testId}` : ''}`);
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

// Traces, spans, and responses tables have been removed - we rely on OpenAI's built-in tracing instead

/**
 * Clean up test data for a specific thread.
 * This is more selective than clearing all data, allowing parallel tests to run safely.
 */
export async function cleanupThreadData(threadId: string) {
  // Delete in order: messages, run states, then thread
  await supabase.from('thread_messages').delete().eq('thread_id', threadId);

  await supabase.from('thread_run_states').delete().eq('thread_id', threadId);

  await supabase.from('threads').delete().eq('id', threadId);
}

/**
 * Clean up old test data (older than 1 hour).
 * This helps keep the test database clean without interfering with running tests.
 * Note: threads.created_at is a Unix timestamp (number), not an ISO string.
 */
export async function cleanupOldTestData() {
  const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);

  // Get old threads (created_at is Unix timestamp in seconds)
  const { data: oldThreads } = await supabase
    .from('threads')
    .select('id')
    .lt('created_at', oneHourAgo);

  if (oldThreads && oldThreads.length > 0) {
    const threadIds = oldThreads.map((t) => t.id);

    // Delete messages
    await supabase.from('thread_messages').delete().in('thread_id', threadIds);

    // Delete run states
    await supabase.from('thread_run_states').delete().in('thread_id', threadIds);

    // Delete threads
    await supabase.from('threads').delete().in('id', threadIds);
  }
}
