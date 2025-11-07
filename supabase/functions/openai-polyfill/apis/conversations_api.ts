// Minimal Conversations API polyfill (in-memory) matching OpenAI Conversations shapes
// NOTE: For production, persist to a database; this polyfill targets API shape compatibility.

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Conversation {
  id: string;
  object: 'conversation';
  created_at: number;
  metadata?: Record<string, JsonValue>;
}

export interface ConversationItem {
  id: string;
  type: 'message' | 'function_call' | 'function_call_output';
  role?: 'user' | 'assistant' | 'system' | string;
  content?: string | { type: string; text?: string }[];
  created_at: number;
  // Function call specific fields
  call_id?: string;
  name?: string;
  arguments?: string | Record<string, any>;
  output?: any;
}

interface UserStore {
  conversations: Map<string, Conversation>;
  items: Map<string, ConversationItem[]>; // key: conversation_id
}

const perUserStore = new Map<string, UserStore>();

function getUserStore(userId: string): UserStore {
  let store = perUserStore.get(userId);
  if (!store) {
    store = { conversations: new Map(), items: new Map() };
    perUserStore.set(userId, store);
  }
  return store;
}

function genId(prefix: string) {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rnd}`;
}

export async function handleConversationsRequest(
  req: Request,
  userId: string,
  pathname: string,
  supabaseClient: any
): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const store = null as any; // DB-backed now

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
  };

  // Helpers for cursor handling
  async function getConversationById(id: string) {
    const { data, error } = await supabaseClient
      .from('conversations')
      .select('id, created_at, metadata')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as { id: string; created_at: number; metadata: any } | null;
  }

  // GET /conversations → list conversations
  if (pathname === '/conversations' && method === 'GET') {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const after = url.searchParams.get('after');
    const before = url.searchParams.get('before');

    let q = supabaseClient
      .from('conversations')
      .select('id, created_at, metadata')
      .order('created_at', { ascending: order === 'asc' })
      .limit(limit + 1);

    if (after) {
      const afterRow = await getConversationById(after);
      if (afterRow) {
        q = q.gt('created_at', afterRow.created_at);
      }
    }
    if (before) {
      const beforeRow = await getConversationById(before);
      if (beforeRow) {
        q = q.lt('created_at', beforeRow.created_at);
      }
    }
    const { data, error } = await q;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const rows = (data || []) as { id: string; created_at: number; metadata: any }[];
    const has_more = rows.length > limit;
    const page = rows.slice(0, limit).map((r) => ({ id: r.id, object: 'conversation', created_at: r.created_at, metadata: r.metadata }));
    return new Response(JSON.stringify({ object: 'list', data: page, has_more }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /conversations → create conversation
  if (pathname === '/conversations' && method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as any;
    const conv: Conversation = {
      id: genId('conv'),
      object: 'conversation',
      created_at: Math.floor(Date.now() / 1000),
      metadata: body?.metadata ?? {},
    };
    {
      const { error } = await supabaseClient.from('conversations').insert({ id: conv.id, user_id: userId, created_at: conv.created_at, metadata: conv.metadata });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const initItems = Array.isArray(body?.items) ? (body.items as any[]) : [];
    for (const it of initItems) {
      const item: ConversationItem = {
        id: genId('item'),
        type: 'message',
        role: it?.role ?? 'user',
        content: it?.content ?? '',
        created_at: Math.floor(Date.now() / 1000),
      };
      const { error: itemErr } = await supabaseClient
        .from('conversation_items')
        .insert({ id: item.id, conversation_id: conv.id, user_id: userId, created_at: item.created_at, type: item.type, role: item.role, content: item.content });
      if (itemErr) return new Response(JSON.stringify({ error: itemErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(conv), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // GET /conversations/{conversation_id}
  const convIdMatch = pathname.match(/^\/conversations\/([^/]+)$/);
  if (convIdMatch && method === 'GET') {
    const convId = convIdMatch[1];
    const { data } = await supabaseClient.from('conversations').select('id, created_at, metadata').eq('id', convId).maybeSingle();
    const conv = data ? ({ id: data.id, object: 'conversation', created_at: data.created_at, metadata: data.metadata } as Conversation) : null;
    if (!conv) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(conv), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // DELETE /conversations/{conversation_id}
  if (convIdMatch && method === 'DELETE') {
    const convId = convIdMatch[1];
    const { error } = await supabaseClient.from('conversations').delete().eq('id', convId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: convId, deleted: true, object: 'conversation.deleted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // PATCH /conversations/{conversation_id} → update metadata
  if (convIdMatch && method === 'PATCH') {
    const convId = convIdMatch[1];
    const { data: existing } = await supabaseClient.from('conversations').select('id, created_at, metadata').eq('id', convId).maybeSingle();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = (await req.json().catch(() => ({}))) as any;
    const newMeta = { ...(existing.metadata ?? {}), ...(body?.metadata ?? {}) };
    const { error } = await supabaseClient.from('conversations').update({ metadata: newMeta }).eq('id', convId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: convId, object: 'conversation', created_at: existing.created_at, metadata: newMeta }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /conversations/{conversation_id}/items → append item(s)
  const convItemsMatch = pathname.match(/^\/conversations\/([^/]+)\/items$/);
  if (convItemsMatch && method === 'POST') {
    const convId = convItemsMatch[1];
    const { data: exists } = await supabaseClient.from('conversations').select('id').eq('id', convId).maybeSingle();
    if (!exists) {
      // Lazily create the conversation if it doesn't exist yet
      const created_at = Math.floor(Date.now() / 1000);
      const { error: insErr } = await supabaseClient
        .from('conversations')
        .insert({ id: convId, user_id: userId, created_at, metadata: {} });
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    const body = (await req.json().catch(() => ({}))) as any;
    
    // According to OpenAI spec, POST expects { items: [...] }
    // But we also support single item format for backward compatibility
    let itemsToProcess: any[] = [];
    if (body.items && Array.isArray(body.items)) {
      // Standard format: { items: [...] }
      itemsToProcess = body.items;
    } else if (body.role && body.content) {
      // Single item format for backward compatibility: { role: "...", content: [...] }
      itemsToProcess = [body];
    } else {
      return new Response(JSON.stringify({ error: 'Missing items array or role/content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Normalize content to Conversations/Responses content parts format
    // Preserves original content type (input_text for user, output_text for assistant)
    function toParts(content: any, role?: string): any[] {
      if (Array.isArray(content)) {
        return content
          .map((p) => {
            if (p && typeof p === 'object' && typeof p.type === 'string') {
              // Preserve original type if it's valid
              const partType = (p as any).type;
              const text = (p as any).text;
              if (typeof text === 'string') {
                return { type: partType, text: text };
              }
              if (typeof (p as any).content === 'string') {
                // Default to input_text for user, output_text for assistant
                const defaultType = role === 'assistant' ? 'output_text' : 'input_text';
                return { type: defaultType, text: (p as any).content };
              }
            }
            if (typeof p === 'string') {
              // Default to input_text for user, output_text for assistant
              const defaultType = role === 'assistant' ? 'output_text' : 'input_text';
              return { type: defaultType, text: p };
            }
            return null;
          })
          .filter((v) => v);
      }
      if (typeof content === 'string') {
        const defaultType = role === 'assistant' ? 'output_text' : 'input_text';
        return [{ type: defaultType, text: content }];
      }
      if (content && typeof content === 'object') {
        const t = (content as any).text ?? (content as any).content;
        if (typeof t === 'string') {
          const defaultType = role === 'assistant' ? 'output_text' : 'input_text';
          return [{ type: defaultType, text: t }];
        }
      }
      return [];
    }
    
    // Process each item
    const createdItems: ConversationItem[] = [];
    for (const itemInput of itemsToProcess) {
      const itemType = itemInput?.type ?? 'message';
      const role = itemInput?.role ?? 'user';

      // Build the ConversationItem based on type
      let item: ConversationItem;
      let dbContent: any;

      if (itemType === 'function_call') {
        // Function call: store call_id, name, arguments in content field as structured data
        item = {
          id: genId('item'),
          type: 'function_call',
          created_at: Math.floor(Date.now() / 1000),
          call_id: itemInput.call_id,
          name: itemInput.name,
          arguments: typeof itemInput.arguments === 'string' ? itemInput.arguments : JSON.stringify(itemInput.arguments ?? {}),
        };
        // Store all function_call data in content JSONB field
        dbContent = {
          call_id: item.call_id,
          name: item.name,
          arguments: item.arguments,
          status: itemInput.status,
        };
      } else if (itemType === 'function_call_output') {
        // Function call output: store call_id and output in content field
        item = {
          id: genId('item'),
          type: 'function_call_output',
          created_at: Math.floor(Date.now() / 1000),
          call_id: itemInput.call_id,
          output: itemInput.output,
        };
        // Store all function_call_output data in content JSONB field
        dbContent = {
          call_id: item.call_id,
          output: item.output,
          status: itemInput.status,
        };
      } else {
        // Regular message: store content parts
        const normalizedContent = toParts(itemInput?.content ?? '', role);
        item = {
          id: genId('item'),
          type: 'message',
          role: role,
          content: normalizedContent,
          created_at: Math.floor(Date.now() / 1000),
        };
        dbContent = normalizedContent;
      }

      const { error } = await supabaseClient
        .from('conversation_items')
        .insert({
          id: item.id,
          conversation_id: convId,
          user_id: userId,
          created_at: item.created_at,
          type: item.type,
          role: item.role ?? null,
          content: dbContent
        });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      createdItems.push(item);
    }
    
    // Return ConversationItemList format according to spec
    return new Response(
      JSON.stringify({
        object: 'list',
        data: createdItems,
        has_more: false,
        first_id: createdItems[0]?.id ?? null,
        last_id: createdItems[createdItems.length - 1]?.id ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // GET /conversations/{conversation_id}/items → list items
  if (convItemsMatch && method === 'GET') {
    const convId = convItemsMatch[1];
    const { data: exists } = await supabaseClient.from('conversations').select('id').eq('id', convId).maybeSingle();
    if (!exists) {
      // Lazily create the conversation and return empty items list
      const created_at = Math.floor(Date.now() / 1000);
      const { error: insErr } = await supabaseClient
        .from('conversations')
        .insert({ id: convId, user_id: userId, created_at, metadata: {} });
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          object: 'list',
          data: [],
          has_more: false,
          first_id: null,
          last_id: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    const { data: itemsData, error } = await supabaseClient
      .from('conversation_items')
      .select('id, created_at, type, role, content')
      .eq('conversation_id', convId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    let list = (itemsData || []) as any[];

    // Reconstruct items based on type
    list = list.map((dbItem: any) => {
      if (dbItem.type === 'function_call') {
        // Reconstruct function_call item from content JSONB
        const content = dbItem.content || {};
        return {
          id: dbItem.id,
          type: 'function_call',
          created_at: dbItem.created_at,
          call_id: content.call_id,
          name: content.name,
          arguments: content.arguments,
          status: content.status,
        };
      } else if (dbItem.type === 'function_call_output') {
        // Reconstruct function_call_output item from content JSONB
        const content = dbItem.content || {};
        return {
          id: dbItem.id,
          type: 'function_call_output',
          created_at: dbItem.created_at,
          call_id: content.call_id,
          output: content.output,
          status: content.status,
        };
      } else {
        // Regular message: normalize content types based on role
        if (dbItem.role === 'assistant' && Array.isArray(dbItem.content)) {
          dbItem.content = dbItem.content.map((part: any) => {
            if (part && typeof part === 'object' && part.type === 'input_text') {
              return { ...part, type: 'output_text' };
            }
            return part;
          });
        }
        return dbItem;
      }
    });
    
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
    // Match OpenAI spec: default order is 'desc' (line 6508 in openapi.documented.yml)
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const after = url.searchParams.get('after');
    const before = url.searchParams.get('before');

    // Sort by created_at, but use id as secondary sort key to ensure stable ordering
    // This is critical because items inserted in the same second will have the same created_at,
    // and JavaScript's sort() is not stable, which can cause function_call and function_call_output
    // to be returned in the wrong order
    let sorted = [...list].sort((a, b) => {
      const timeDiff = order === 'asc' ? a.created_at - b.created_at : b.created_at - a.created_at;
      if (timeDiff !== 0) return timeDiff;
      // If timestamps are equal, sort by id to ensure stable ordering
      return a.id.localeCompare(b.id);
    });
    if (after) {
      const idx = sorted.findIndex((i) => i.id === after);
      if (idx >= 0) sorted = sorted.slice(idx + 1);
    }
    if (before) {
      const idx = sorted.findIndex((i) => i.id === before);
      if (idx >= 0) sorted = sorted.slice(0, idx);
    }
    const has_more = sorted.length > limit;
    const data = sorted.slice(0, limit);
    return new Response(
      JSON.stringify({
        object: 'list',
        data,
        has_more,
        first_id: data[0]?.id ?? null,
        last_id: data[data.length - 1]?.id ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // GET /conversations/{conversation_id}/items/{item_id} → retrieve item
  const convItemMatch = pathname.match(/^\/conversations\/([^/]+)\/items\/([^/]+)$/);
  if (convItemMatch && method === 'GET') {
    const convId = convItemMatch[1];
    const itemId = convItemMatch[2];
    const { data, error } = await supabaseClient
      .from('conversation_items')
      .select('id, created_at, type, role, content')
      .eq('conversation_id', convId)
      .eq('id', itemId)
      .maybeSingle();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Reconstruct item based on type
    let item: ConversationItem | undefined;
    if (data) {
      if (data.type === 'function_call') {
        // Reconstruct function_call item from content JSONB
        const content = data.content || {};
        item = {
          id: data.id,
          type: 'function_call',
          created_at: data.created_at,
          call_id: content.call_id,
          name: content.name,
          arguments: content.arguments,
        };
      } else if (data.type === 'function_call_output') {
        // Reconstruct function_call_output item from content JSONB
        const content = data.content || {};
        item = {
          id: data.id,
          type: 'function_call_output',
          created_at: data.created_at,
          call_id: content.call_id,
          output: content.output,
        };
      } else {
        // Regular message: normalize content types based on role
        if (data.role === 'assistant' && Array.isArray(data.content)) {
          data.content = data.content.map((part: any) => {
            if (part && typeof part === 'object' && part.type === 'input_text') {
              return { ...part, type: 'output_text' };
            }
            return part;
          });
        }
        item = { id: data.id, created_at: data.created_at, type: data.type, role: data.role, content: data.content } as ConversationItem;
      }
    }
    if (!item) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(item), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // DELETE /conversations/{conversation_id}/items/{item_id}
  if (convItemMatch && method === 'DELETE') {
    const convId = convItemMatch[1];
    const itemId = convItemMatch[2];
    const { error } = await supabaseClient
      .from('conversation_items')
      .delete()
      .eq('conversation_id', convId)
      .eq('id', itemId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: itemId, deleted: true, object: 'conversation.item.deleted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // PATCH /conversations/{conversation_id}/items/{item_id} → update (e.g., content)
  if (convItemMatch && method === 'PATCH') {
    const convId = convItemMatch[1];
    const itemId = convItemMatch[2];
    const body = (await req.json().catch(() => ({}))) as any;
    const { data, error } = await supabaseClient
      .from('conversation_items')
      .update({ content: body?.content, role: body?.role })
      .eq('conversation_id', convId)
      .eq('id', itemId)
      .select('id, created_at, type, role, content')
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: data.id, created_at: data.created_at, type: data.type, role: data.role, content: data.content }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}


