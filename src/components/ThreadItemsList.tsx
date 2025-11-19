import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface ThreadItem {
  id: string;
  type: string;
  created_at: number;
  data: any;
  thread_id: string;
}

export function ThreadItemsList({ threadId }: { threadId?: string }) {
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (threadId) {
      fetchThreadItems();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [threadId]);

  async function fetchThreadItems() {
    try {
      const { data, error } = await supabase
        .from('chatkit_thread_items')
        .select('*')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching thread items:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col border-l border-border bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Thread Items</h2>
      </div>
      
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {threadId ? 'No items in this thread' : 'Select a conversation to view items'}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-primary uppercase">
                    {item.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(item.created_at, { addSuffix: true })}
                  </span>
                </div>
                <pre className="text-xs text-foreground overflow-auto max-h-40">
                  {JSON.stringify(item.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
