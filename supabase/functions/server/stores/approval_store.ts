// Simple in-memory approval store keyed by thread and tool call id
// For production, replace with persistent storage (e.g., Supabase table)

const approvedByThread: Map<string, Set<string>> = new Map();

export function markApproved(threadId: string, toolCallId: string): void {
  if (!approvedByThread.has(threadId)) approvedByThread.set(threadId, new Set());
  approvedByThread.get(threadId)!.add(toolCallId);
}

export function clearApproved(threadId: string, toolCallId: string): void {
  approvedByThread.get(threadId)?.delete(toolCallId);
}

export function isApproved(threadId: string, toolCallId: string): boolean {
  return approvedByThread.get(threadId)?.has(toolCallId) ?? false;
}
