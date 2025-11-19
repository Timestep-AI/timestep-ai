import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface Thread {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: string;
}

export function ConversationsList() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreads();
  }, []);

  async function fetchThreads() {
    try {
      const { data, error } = await supabase
        .from('chatkit_threads')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setThreads(data || []);
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col border-r border-border bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
      </div>
      
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No conversations yet</div>
        ) : (
          <div className="p-2 space-y-1">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="font-medium text-sm text-foreground truncate">
                  {thread.title || 'Untitled Conversation'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
