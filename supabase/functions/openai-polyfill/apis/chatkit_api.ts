// ChatKit API implementation for OpenAI ChatKit endpoints
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

interface ChatKitThread {
  id: string;
  object: 'chatkit.thread';
  created_at: number;
  title: string | null;
  status: { type: 'active' } | { type: 'locked'; reason: string };
  user: string;
}

interface ChatKitThreadItem {
  id: string;
  object: 'chatkit.thread_item';
  thread_id: string;
  created_at: number;
  type: string;
  [key: string]: any;
}

interface ListResponse<T> {
  object: 'list';
  data: T[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
}

/**
 * List ChatKit threads
 * GET /chatkit/threads
 */
async function listThreads(
  supabaseClient: SupabaseClient,
  userId: string,
  params: URLSearchParams
): Promise<Response> {
  const limit = parseInt(params.get('limit') || '20');
  const order = params.get('order') || 'desc';
  const after = params.get('after');
  const before = params.get('before');
  const userFilter = params.get('user');

  let query = supabaseClient
    .from('chatkit_threads')
    .select('*')
    .eq('user_id', userFilter || userId)
    .order('created_at', { ascending: order === 'asc' })
    .limit(limit + 1); // Fetch one extra to check has_more

  if (after) {
    const { data: afterThread } = await supabaseClient
      .from('chatkit_threads')
      .select('created_at')
      .eq('id', after)
      .single();
    if (afterThread) {
      query = query.gt('created_at', afterThread.created_at);
    }
  }

  if (before) {
    const { data: beforeThread } = await supabaseClient
      .from('chatkit_threads')
      .select('created_at')
      .eq('id', before)
      .single();
    if (beforeThread) {
      query = query.lt('created_at', beforeThread.created_at);
    }
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const hasMore = data.length > limit;
  const threads = hasMore ? data.slice(0, limit) : data;

  const response: ListResponse<ChatKitThread> = {
    object: 'list',
    data: threads.map((t) => ({
      id: t.id,
      object: 'chatkit.thread',
      created_at: t.created_at,
      title: t.title,
      status: t.status,
      user: t.user_id,
    })),
    first_id: threads.length > 0 ? threads[0].id : null,
    last_id: threads.length > 0 ? threads[threads.length - 1].id : null,
    has_more: hasMore,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Retrieve a ChatKit thread
 * GET /chatkit/threads/{thread_id}
 */
async function getThread(
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<Response> {
  const { data: thread, error } = await supabaseClient
    .from('chatkit_threads')
    .select('*')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (error || !thread) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const response: ChatKitThread = {
    id: thread.id,
    object: 'chatkit.thread',
    created_at: thread.created_at,
    title: thread.title,
    status: thread.status,
    user: thread.user_id,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Delete a ChatKit thread
 * DELETE /chatkit/threads/{thread_id}
 */
async function deleteThread(
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<Response> {
  const { error } = await supabaseClient
    .from('chatkit_threads')
    .delete()
    .eq('id', threadId)
    .eq('user_id', userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      id: threadId,
      object: 'chatkit.thread.deleted',
      deleted: true,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * CUSTOM: Add a thread item
 * POST /chatkit/threads/{thread_id}/items
 * Note: This is a custom endpoint not in the official OpenAI ChatKit API
 */
async function addThreadItem(
  req: Request,
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<Response> {
  const body = await req.json();
  const { id, created_at, type, data, item_index } = body;

  // Ensure thread exists
  const { data: thread } = await supabaseClient
    .from('chatkit_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (!thread) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Insert the item
  const { error } = await supabaseClient
    .from('chatkit_thread_items')
    .insert({
      id,
      object: 'chatkit.thread_item',
      thread_id: threadId,
      created_at,
      type,
      data,
      item_index,
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * CUSTOM: Update a thread item
 * PUT /chatkit/threads/{thread_id}/items/{item_id}
 * Note: This is a custom endpoint not in the official OpenAI ChatKit API
 */
async function updateThreadItem(
  req: Request,
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string,
  itemId: string
): Promise<Response> {
  const body = await req.json();
  const { data } = body;

  // Verify thread belongs to user
  const { data: thread } = await supabaseClient
    .from('chatkit_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (!thread) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update the item
  const { error } = await supabaseClient
    .from('chatkit_thread_items')
    .update({ data, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('thread_id', threadId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, id: itemId }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * CUSTOM: Delete a thread item
 * DELETE /chatkit/threads/{thread_id}/items/{item_id}
 * Note: This is a custom endpoint not in the official OpenAI ChatKit API
 */
async function deleteThreadItem(
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string,
  itemId: string
): Promise<Response> {
  // Verify thread belongs to user
  const { data: thread } = await supabaseClient
    .from('chatkit_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (!thread) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Delete the item
  const { error } = await supabaseClient
    .from('chatkit_thread_items')
    .delete()
    .eq('id', itemId)
    .eq('thread_id', threadId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      id: itemId,
      object: 'chatkit.thread_item.deleted',
      deleted: true,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * CUSTOM: Get next item index for a thread
 * POST /chatkit/threads/{thread_id}/next_index
 * Note: This is a custom endpoint not in the official OpenAI ChatKit API
 */
async function getNextItemIndex(
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<Response> {
  // Verify thread belongs to user
  const { data: thread } = await supabaseClient
    .from('chatkit_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (!thread) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Call RPC function to get next index
  const { data, error } = await supabaseClient.rpc('get_next_chatkit_item_index', {
    p_thread_id: threadId,
  });

  if (error || data === null) {
    return new Response(JSON.stringify({ error: 'Failed to get next index' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ next_index: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * CUSTOM: Create or ensure a thread exists
 * POST /chatkit/threads/{thread_id}/ensure
 * Note: This is a custom endpoint not in the official OpenAI ChatKit API
 */
async function ensureThread(
  _req: Request,
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<Response> {
  // Check if thread exists
  const { data: existingThread } = await supabaseClient
    .from('chatkit_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (existingThread) {
    return new Response(JSON.stringify({ exists: true, id: threadId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create thread
  const createdAt = Math.floor(Date.now() / 1000);
  const { error } = await supabaseClient.from('chatkit_threads').insert({
    id: threadId,
    object: 'chatkit.thread',
    created_at: createdAt,
    title: null,
    status: { type: 'active' },
    user_id: userId,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ exists: false, created: true, id: threadId }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * List ChatKit thread items
 * GET /chatkit/threads/{thread_id}/items
 */
async function listThreadItems(
  supabaseClient: SupabaseClient,
  userId: string,
  threadId: string,
  params: URLSearchParams
): Promise<Response> {
  // First verify the thread belongs to the user
  const { data: thread } = await supabaseClient
    .from('chatkit_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (!thread) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const limit = parseInt(params.get('limit') || '20');
  const order = params.get('order') || 'desc';
  const after = params.get('after');
  const before = params.get('before');

  let query = supabaseClient
    .from('chatkit_thread_items')
    .select('*')
    .eq('thread_id', threadId)
    .order('item_index', { ascending: order === 'asc' })
    .limit(limit + 1);

  if (after) {
    const { data: afterItem } = await supabaseClient
      .from('chatkit_thread_items')
      .select('item_index')
      .eq('id', after)
      .single();
    if (afterItem) {
      query = query.gt('item_index', afterItem.item_index);
    }
  }

  if (before) {
    const { data: beforeItem } = await supabaseClient
      .from('chatkit_thread_items')
      .select('item_index')
      .eq('id', before)
      .single();
    if (beforeItem) {
      query = query.lt('item_index', beforeItem.item_index);
    }
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  // Reconstruct thread items from stored data
  const threadItems = items.map((item) => ({
    id: item.id,
    object: 'chatkit.thread_item',
    thread_id: item.thread_id,
    created_at: item.created_at,
    type: item.type,
    ...item.data, // Spread the JSON data which contains type-specific fields
  }));

  const response: ListResponse<ChatKitThreadItem> = {
    object: 'list',
    data: threadItems,
    first_id: items.length > 0 ? items[0].id : null,
    last_id: items.length > 0 ? items[items.length - 1].id : null,
    has_more: hasMore,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Main handler for ChatKit API requests
 */
export async function handleChatKitRequest(
  req: Request,
  supabaseClient: SupabaseClient,
  userId: string,
  pathname: string
): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Parse the pathname to determine the endpoint
  const pathParts = pathname.split('/').filter((p) => p);

  // Remove 'chatkit' prefix if present
  if (pathParts[0] === 'chatkit') {
    pathParts.shift();
  }

  // Route based on path structure
  if (pathParts.length === 1 && pathParts[0] === 'threads') {
    // GET /chatkit/threads - list threads
    if (req.method === 'GET') {
      return await listThreads(supabaseClient, userId, params);
    }
  } else if (pathParts.length === 2 && pathParts[0] === 'threads') {
    const threadId = pathParts[1];

    // GET /chatkit/threads/{thread_id} - get thread
    if (req.method === 'GET') {
      return await getThread(supabaseClient, userId, threadId);
    }

    // DELETE /chatkit/threads/{thread_id} - delete thread
    if (req.method === 'DELETE') {
      return await deleteThread(supabaseClient, userId, threadId);
    }
  } else if (pathParts.length === 3 && pathParts[0] === 'threads' && pathParts[2] === 'items') {
    const threadId = pathParts[1];

    // CUSTOM: POST /chatkit/threads/{thread_id}/items - add thread item
    if (req.method === 'POST') {
      return await addThreadItem(req, supabaseClient, userId, threadId);
    }

    // GET /chatkit/threads/{thread_id}/items - list thread items
    if (req.method === 'GET') {
      return await listThreadItems(supabaseClient, userId, threadId, params);
    }
  } else if (pathParts.length === 4 && pathParts[0] === 'threads' && pathParts[2] === 'items') {
    const threadId = pathParts[1];
    const itemId = pathParts[3];

    // CUSTOM: PUT /chatkit/threads/{thread_id}/items/{item_id} - update thread item
    if (req.method === 'PUT') {
      return await updateThreadItem(req, supabaseClient, userId, threadId, itemId);
    }

    // CUSTOM: DELETE /chatkit/threads/{thread_id}/items/{item_id} - delete thread item
    if (req.method === 'DELETE') {
      return await deleteThreadItem(supabaseClient, userId, threadId, itemId);
    }
  } else if (pathParts.length === 3 && pathParts[0] === 'threads' && pathParts[2] === 'next_index') {
    const threadId = pathParts[1];

    // CUSTOM: POST /chatkit/threads/{thread_id}/next_index - get next item index
    if (req.method === 'POST') {
      return await getNextItemIndex(supabaseClient, userId, threadId);
    }
  } else if (pathParts.length === 3 && pathParts[0] === 'threads' && pathParts[2] === 'ensure') {
    const threadId = pathParts[1];

    // CUSTOM: POST /chatkit/threads/{thread_id}/ensure - ensure thread exists
    if (req.method === 'POST') {
      return await ensureThread(req, supabaseClient, userId, threadId);
    }
  }

  return new Response(
    JSON.stringify({
      error: 'ChatKit endpoint not found',
      path: pathname,
    }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
