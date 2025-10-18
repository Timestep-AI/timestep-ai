// OpenAI Vector Stores API implementation

// TypeScript interfaces for Vector Stores API (from OpenAI OpenAPI spec)

export interface VectorStoreFileCounts {
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface VectorStoreExpirationAfter {
  anchor: 'last_active_at';
  days: number;
}

export interface VectorStoreObject {
  id: string;
  object: 'vector_store';
  created_at: number;
  name: string;
  usage_bytes: number;
  file_counts: VectorStoreFileCounts;
  status: 'expired' | 'in_progress' | 'completed';
  expires_after?: VectorStoreExpirationAfter | null;
  expires_at?: number | null;
  last_active_at: number | null;
  metadata: Record<string, any> | null;
}

export interface CreateVectorStoreRequest {
  file_ids?: string[];
  name?: string;
  description?: string;
  expires_after?: VectorStoreExpirationAfter;
  chunking_strategy?: any; // ChunkingStrategyRequestParam
  metadata?: Record<string, any>;
}

export interface UpdateVectorStoreRequest {
  name?: string;
  description?: string;
  expires_after?: VectorStoreExpirationAfter;
  metadata?: Record<string, any>;
}

export interface ListVectorStoresResponse {
  object: 'list';
  data: VectorStoreObject[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}

export interface DeleteVectorStoreResponse {
  id: string;
  deleted: boolean;
  object: 'vector_store.deleted';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

/**
 * Main router for Vector Stores API endpoints
 */
export async function handleVectorStoresRequest(
  req: Request,
  supabaseClient: any,
  userId: string,
  pathname: string
): Promise<Response> {
  // Parse the path to determine which endpoint to handle
  const pathParts = pathname.split('/').filter(Boolean);

  // /vector_stores
  if (pathParts.length === 1 && pathParts[0] === 'vector_stores') {
    if (req.method === 'GET') {
      return await listVectorStores(req, supabaseClient, userId);
    } else if (req.method === 'POST') {
      return await createVectorStore(req, supabaseClient, userId);
    }
  }

  // /vector_stores/{vector_store_id}
  if (pathParts.length === 2 && pathParts[0] === 'vector_stores') {
    const vectorStoreId = pathParts[1];

    if (req.method === 'GET') {
      return await getVectorStore(req, supabaseClient, userId, vectorStoreId);
    } else if (req.method === 'POST') {
      return await modifyVectorStore(req, supabaseClient, userId, vectorStoreId);
    } else if (req.method === 'DELETE') {
      return await deleteVectorStore(req, supabaseClient, userId, vectorStoreId);
    }
  }

  // /vector_stores/{vector_store_id}/files
  if (pathParts.length === 3 && pathParts[0] === 'vector_stores' && pathParts[2] === 'files') {
    const vectorStoreId = pathParts[1];

    if (req.method === 'GET') {
      return await listVectorStoreFiles(req, supabaseClient, userId, vectorStoreId);
    } else if (req.method === 'POST') {
      return await createVectorStoreFile(req, supabaseClient, userId, vectorStoreId);
    }
  }

  // /vector_stores/{vector_store_id}/files/{file_id}
  if (pathParts.length === 4 && pathParts[0] === 'vector_stores' && pathParts[2] === 'files') {
    const vectorStoreId = pathParts[1];
    const fileId = pathParts[3];

    if (req.method === 'GET') {
      return await getVectorStoreFile(req, supabaseClient, userId, vectorStoreId, fileId);
    } else if (req.method === 'DELETE') {
      return await deleteVectorStoreFile(req, supabaseClient, userId, vectorStoreId, fileId);
    }
  }

  return new Response(
    JSON.stringify({ error: 'Vector stores endpoint not found' }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * GET /vector_stores
 * List vector stores
 */
async function listVectorStores(
  req: Request,
  _supabaseClient: any,
  _userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const order = url.searchParams.get('order') || 'desc';
    const after = url.searchParams.get('after');
    const before = url.searchParams.get('before');

    console.log('[VectorStores] Listing vector stores', { limit, order, after, before });

    // TODO: Implement actual vector store listing from database
    const response: ListVectorStoresResponse = {
      object: 'list',
      data: [],
      first_id: '',
      last_id: '',
      has_more: false,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error listing vector stores:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /vector_stores
 * Create a vector store
 */
async function createVectorStore(
  req: Request,
  _supabaseClient: any,
  _userId: string
): Promise<Response> {
  try {
    const body: CreateVectorStoreRequest = await req.json();
    console.log('[VectorStores] Creating vector store:', body.name);

    // TODO: Implement actual vector store creation in database
    const now = Math.floor(Date.now() / 1000);
    const vectorStore: VectorStoreObject = {
      id: `vs_${generateId()}`,
      object: 'vector_store',
      created_at: now,
      name: body.name || '',
      usage_bytes: 0,
      file_counts: {
        in_progress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      },
      status: 'completed',
      last_active_at: now,
      metadata: body.metadata || null,
    };

    return new Response(JSON.stringify(vectorStore), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error creating vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * GET /vector_stores/{vector_store_id}
 * Retrieve a vector store
 */
async function getVectorStore(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  try {
    console.log('[VectorStores] Getting vector store:', vectorStoreId);

    // TODO: Implement actual vector store retrieval from database
    const now = Math.floor(Date.now() / 1000);
    const vectorStore: VectorStoreObject = {
      id: vectorStoreId,
      object: 'vector_store',
      created_at: now,
      name: 'Sample Vector Store',
      usage_bytes: 0,
      file_counts: {
        in_progress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      },
      status: 'completed',
      last_active_at: now,
      metadata: null,
    };

    return new Response(JSON.stringify(vectorStore), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error getting vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /vector_stores/{vector_store_id}
 * Modify a vector store
 */
async function modifyVectorStore(
  req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  try {
    const body: UpdateVectorStoreRequest = await req.json();
    console.log('[VectorStores] Modifying vector store:', vectorStoreId);

    // TODO: Implement actual vector store modification in database
    const now = Math.floor(Date.now() / 1000);
    const vectorStore: VectorStoreObject = {
      id: vectorStoreId,
      object: 'vector_store',
      created_at: now,
      name: body.name || 'Modified Vector Store',
      usage_bytes: 0,
      file_counts: {
        in_progress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      },
      status: 'completed',
      last_active_at: now,
      metadata: body.metadata || null,
    };

    return new Response(JSON.stringify(vectorStore), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error modifying vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * DELETE /vector_stores/{vector_store_id}
 * Delete a vector store
 */
async function deleteVectorStore(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  try {
    console.log('[VectorStores] Deleting vector store:', vectorStoreId);

    // TODO: Implement actual vector store deletion from database
    const response: DeleteVectorStoreResponse = {
      id: vectorStoreId,
      deleted: true,
      object: 'vector_store.deleted',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error deleting vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * GET /vector_stores/{vector_store_id}/files
 * List vector store files (stub)
 */
async function listVectorStoreFiles(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  console.log('[VectorStores] Listing files for vector store:', vectorStoreId);

  // TODO: Implement file listing
  return new Response(
    JSON.stringify({
      object: 'list',
      data: [],
      first_id: '',
      last_id: '',
      has_more: false,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * POST /vector_stores/{vector_store_id}/files
 * Create a vector store file (stub)
 */
async function createVectorStoreFile(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  console.log('[VectorStores] Creating file for vector store:', vectorStoreId);

  // TODO: Implement file creation
  return new Response(
    JSON.stringify({
      error: 'Not yet implemented',
    }),
    {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * GET /vector_stores/{vector_store_id}/files/{file_id}
 * Get a vector store file (stub)
 */
async function getVectorStoreFile(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string,
  fileId: string
): Promise<Response> {
  console.log('[VectorStores] Getting file:', fileId, 'from vector store:', vectorStoreId);

  // TODO: Implement file retrieval
  return new Response(
    JSON.stringify({
      error: 'Not yet implemented',
    }),
    {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * DELETE /vector_stores/{vector_store_id}/files/{file_id}
 * Delete a vector store file (stub)
 */
async function deleteVectorStoreFile(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string,
  fileId: string
): Promise<Response> {
  console.log('[VectorStores] Deleting file:', fileId, 'from vector store:', vectorStoreId);

  // TODO: Implement file deletion
  return new Response(
    JSON.stringify({
      id: fileId,
      deleted: true,
      object: 'vector_store.file.deleted',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Helper function to generate a random ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Helper function to create error responses
 */
function createErrorResponse(error: unknown): Response {
  return new Response(
    JSON.stringify({
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'api_error',
        param: null,
        code: null,
      },
    }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
