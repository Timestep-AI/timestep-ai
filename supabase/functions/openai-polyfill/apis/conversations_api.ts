
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
  status?: 'completed' | 'in_progress' | 'incomplete';
  role?: 'user' | 'assistant' | 'system' | string;
  content?: string | { type: string; text?: string }[];
  created_at: number;
  // Function call specific fields
  call_id?: string;
  name?: string;
  arguments?: string | Record<string, any>;
  output?: any;
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
  const method = req.method.toUpperCase();

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
  };


  function normalizeMessageContent(content: any, role: string): any[] {
    if (!content) {
      return [];
    }
    
    const expectedType = role === 'assistant' ? 'output_text' : 'input_text';
    
    if (typeof content === 'string') {
      return [{ type: expectedType, text: content }];
    }
    
    if (Array.isArray(content)) {
      return content
        .map((part: any) => {
          if (typeof part === 'string') {
            return { type: expectedType, text: part };
          }
          
          if (part && typeof part === 'object' && typeof part.text === 'string') {
            const partType = part.type;
            if ((role === 'assistant' && partType === 'input_text') ||
                (role === 'user' && partType === 'output_text')) {
              return { type: expectedType, text: part.text };
            }
            if (partType === 'input_text' || partType === 'output_text') {
              return { type: partType, text: part.text };
            }
            return { type: expectedType, text: part.text };
          }
          
          return null;
        })
        .filter((v: any) => v !== null);
    }
    
    return [];
  }


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
    if (initItems.length > 20) {
      return new Response(JSON.stringify({ error: 'Maximum 20 items allowed per request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    for (const it of initItems) {
      const role = it?.role ?? 'user';
      const item: ConversationItem = {
        id: genId('item'),
        type: 'message',
        status: 'completed',
        role: role,
        content: it?.content ?? '',
        created_at: Math.floor(Date.now() / 1000),
      };
      const { error: itemErr } = await supabaseClient
        .from('conversation_items')
        .insert({ id: item.id, conversation_id: conv.id, user_id: userId, created_at: item.created_at, type: item.type, role: item.role, content: it?.content ?? '' });
      if (itemErr) return new Response(JSON.stringify({ error: itemErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(conv), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const convItemsMatch = pathname.match(/^\/conversations\/([^/]+)\/items$/);
  if (convItemsMatch && method === 'POST') {
    const convId = convItemsMatch[1];
    const { data: exists } = await supabaseClient.from('conversations').select('id').eq('id', convId).maybeSingle();
    if (!exists) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = (await req.json().catch(() => ({}))) as any;
    
    if (!body.items || !Array.isArray(body.items)) {
      return new Response(JSON.stringify({ error: 'Missing required items array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (body.items.length > 20) {
      return new Response(JSON.stringify({ error: 'Maximum 20 items allowed per request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const itemsToProcess = body.items;
    const createdItems: ConversationItem[] = [];
    for (const itemInput of itemsToProcess) {
      const itemType = itemInput?.type ?? 'message';
      const role = itemInput?.role ?? 'user';

      // Build the ConversationItem based on type
      let item: ConversationItem;
      let dbContent: any;

      if (itemType === 'function_call') {
        const argumentsStr = typeof itemInput.arguments === 'string' 
          ? itemInput.arguments 
          : JSON.stringify(itemInput.arguments ?? {});
        
        item = {
          id: genId('item'),
          type: 'function_call',
          created_at: Math.floor(Date.now() / 1000),
          call_id: itemInput.call_id,
          name: itemInput.name,
          arguments: argumentsStr,
          status: itemInput.status || 'completed',
        };
        dbContent = null;
      } else if (itemType === 'function_call_output') {
        item = {
          id: genId('item'),
          type: 'function_call_output',
          created_at: Math.floor(Date.now() / 1000),
          call_id: itemInput.call_id,
          output: itemInput.output,
          status: itemInput.status || 'completed',
        };
        dbContent = null;
      } else {
        item = {
          id: genId('item'),
          type: 'message',
          status: 'completed',
          role: role,
          content: itemInput?.content ?? '',
          created_at: Math.floor(Date.now() / 1000),
        };
        dbContent = itemInput?.content ?? '';
      }

      // Insert with appropriate columns based on type
      const insertData: any = {
        id: item.id,
        conversation_id: convId,
        user_id: userId,
        created_at: item.created_at,
        type: item.type,
        role: item.role ?? null,
        content: dbContent,
      };
      
      if (itemType === 'function_call') {
        insertData.call_id = item.call_id;
        insertData.name = item.name;
        insertData.arguments = item.arguments;
        insertData.status = item.status;
      } else if (itemType === 'function_call_output') {
        insertData.call_id = item.call_id;
        insertData.output = item.output;
        insertData.status = item.status;
      }

      const { error } = await supabaseClient
        .from('conversation_items')
        .insert(insertData);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (item.type === 'message') {
        item.content = normalizeMessageContent(item.content, role);
      }
      createdItems.push(item);
    }
    
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

  if (convIdMatch && method === 'DELETE') {
    const convId = convIdMatch[1];
    const { error } = await supabaseClient.from('conversations').delete().eq('id', convId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: convId, deleted: true, object: 'conversation.deleted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (convIdMatch && method === 'POST') {
    const convId = convIdMatch[1];
    const { data: existing } = await supabaseClient.from('conversations').select('id, created_at, metadata').eq('id', convId).maybeSingle();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = (await req.json().catch(() => ({}))) as any;
    if (!body || body.metadata === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required field: metadata' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const newMeta = body.metadata;
    const { error } = await supabaseClient.from('conversations').update({ metadata: newMeta }).eq('id', convId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ id: convId, object: 'conversation', created_at: existing.created_at, metadata: newMeta }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (convItemsMatch && method === 'GET') {
    const convId = convItemsMatch[1];
    const { data: exists } = await supabaseClient.from('conversations').select('id').eq('id', convId).maybeSingle();
    if (!exists) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: itemsData, error } = await supabaseClient
      .from('conversation_items')
      .select('id, created_at, type, role, content, call_id, name, arguments, output, status')
      .eq('conversation_id', convId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    let list = (itemsData || []) as any[];

    list = list.map((dbItem: any) => {
      if (dbItem.type === 'function_call') {
        return {
          id: dbItem.id,
          type: 'function_call',
          created_at: dbItem.created_at,
          call_id: dbItem.call_id,
          name: dbItem.name,
          arguments: dbItem.arguments,
          status: dbItem.status || 'completed',
        };
      } else if (dbItem.type === 'function_call_output') {
        return {
          id: dbItem.id,
          type: 'function_call_output',
          created_at: dbItem.created_at,
          call_id: dbItem.call_id,
          output: dbItem.output,
          status: dbItem.status || 'completed',
        };
      } else {
        const normalizedContent = normalizeMessageContent(dbItem.content, dbItem.role || 'user');
        return {
          id: dbItem.id,
          type: dbItem.type || 'message',
          status: dbItem.status || 'completed',
          role: dbItem.role,
          content: normalizedContent,
          created_at: dbItem.created_at,
        };
      }
    });
    
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const after = url.searchParams.get('after');

    let sorted = [...list].sort((a, b) => {
      const timeDiff = order === 'asc' ? a.created_at - b.created_at : b.created_at - a.created_at;
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
    if (after) {
      const idx = sorted.findIndex((i) => i.id === after);
      if (idx >= 0) sorted = sorted.slice(idx + 1);
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

  const convItemMatch = pathname.match(/^\/conversations\/([^/]+)\/items\/([^/]+)$/);
  if (convItemMatch && method === 'GET') {
    const convId = convItemMatch[1];
    const itemId = convItemMatch[2];
    const { data, error } = await supabaseClient
      .from('conversation_items')
      .select('id, created_at, type, role, content, call_id, name, arguments, output, status')
      .eq('conversation_id', convId)
      .eq('id', itemId)
      .maybeSingle();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let item: ConversationItem | undefined;
    if (data) {
      if (data.type === 'function_call') {
        item = {
          id: data.id,
          type: 'function_call',
          created_at: data.created_at,
          call_id: data.call_id,
          name: data.name,
          arguments: data.arguments,
          status: data.status || 'completed',
        };
      } else if (data.type === 'function_call_output') {
        item = {
          id: data.id,
          type: 'function_call_output',
          created_at: data.created_at,
          call_id: data.call_id,
          output: data.output,
          status: data.status || 'completed',
        };
      } else {
        const normalizedContent = normalizeMessageContent(data.content, data.role || 'user');
        item = {
          id: data.id,
          type: data.type || 'message',
          status: data.status || 'completed',
          role: data.role,
          content: normalizedContent,
          created_at: data.created_at,
        } as ConversationItem;
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

  if (convItemMatch && method === 'DELETE') {
    const convId = convItemMatch[1];
    const itemId = convItemMatch[2];
    const { error } = await supabaseClient
      .from('conversation_items')
      .delete()
      .eq('conversation_id', convId)
      .eq('id', itemId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: convData } = await supabaseClient.from('conversations').select('id, created_at, metadata').eq('id', convId).maybeSingle();
    if (!convData) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ id: convData.id, object: 'conversation', created_at: convData.created_at, metadata: convData.metadata }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
