import { ThreadRunStateStore } from '../stores/thread_run_state_store.ts';

/**
 * Service for managing thread run states
 * 
 * This service handles business logic related to agent execution state,
 * conversation context, and other runtime state information. It provides
 * a clean interface for managing run states while keeping the store
 * focused on database operations.
 */
export class ThreadRunStateService {
  private store: ThreadRunStateStore;

  constructor(
    supabaseUrl: string,
    userJwt: string,
    userId: string
  ) {
    this.store = new ThreadRunStateStore(supabaseUrl, userJwt, userId);
  }

  /**
   * Save run state for a thread
   * 
   * Stores agent execution state, conversation context, and other runtime
   * information that needs to persist across agent runs.
   */
  async saveRunState(threadId: string, state: string): Promise<void> {
    return this.store.saveRunState(threadId, state);
  }

  /**
   * Load run state for a thread
   * 
   * Retrieves the stored execution state for a thread, which can include
   * conversation context, tool call states, and other runtime information.
   */
  async loadRunState(threadId: string): Promise<string | null> {
    return this.store.loadRunState(threadId);
  }

  /**
   * Clear run state for a thread
   * 
   * Removes all stored execution state for a thread, effectively resetting
   * the agent's context and starting fresh.
   */
  async clearRunState(threadId: string): Promise<void> {
    return this.store.clearRunState(threadId);
  }

  /**
   * Check if run state exists for a thread
   * 
   * Useful for determining if a thread has any stored execution state
   * before attempting to load it.
   */
  async hasRunState(threadId: string): Promise<boolean> {
    return this.store.hasRunState(threadId);
  }

  /**
   * Get all run states for debugging/admin purposes
   * 
   * Returns all run states for the current user, useful for debugging
   * or administrative tasks.
   */
  async getAllRunStates(): Promise<Array<{ thread_id: string; state_data: string; updated_at: string }>> {
    return this.store.getAllRunStates();
  }

  /**
   * Cleanup old run states
   * 
   * Removes run states older than the specified number of days to prevent
   * database bloat and maintain performance.
   */
  async cleanupOldRunStates(daysOld: number = 30): Promise<number> {
    return this.store.cleanupOldRunStates(daysOld);
  }

  /**
   * Parse run state as JSON
   * 
   * Convenience method to parse stored run state as JSON object.
   * Returns null if parsing fails or state doesn't exist.
   */
  async loadRunStateAsJson(threadId: string): Promise<any | null> {
    const stateData = await this.loadRunState(threadId);
    if (!stateData) {
      return null;
    }

    try {
      return JSON.parse(stateData);
    } catch (error) {
      console.error('Error parsing run state JSON:', error);
      return null;
    }
  }

  /**
   * Save run state as JSON
   * 
   * Convenience method to save a JavaScript object as JSON string
   * in the run state.
   */
  async saveRunStateAsJson(threadId: string, stateObject: any): Promise<void> {
    const stateData = JSON.stringify(stateObject);
    return this.saveRunState(threadId, stateData);
  }

  /**
   * Update run state with partial data
   * 
   * Loads existing run state, merges with new data, and saves back.
   * Useful for updating specific fields in the run state.
   */
  async updateRunState(threadId: string, updates: any): Promise<void> {
    const existingState = await this.loadRunStateAsJson(threadId);
    const mergedState = { ...existingState, ...updates };
    return this.saveRunStateAsJson(threadId, mergedState);
  }
}
